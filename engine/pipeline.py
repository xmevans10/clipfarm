"""Download bounded video, rank real transcript spans, and render short-form MP4s."""
import base64
import http.client
import ipaddress
import json
import math
import re
import socket
import ssl
import subprocess
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

MAX_BYTES = 800_000_000
MAX_DURATION = 3600
CHUNK_SECONDS = 300
WHITELIST = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm"]


class InvalidSource(Exception):
    pass


class StageError(Exception):
    pass


class PinnedHTTPS(http.client.HTTPSConnection):
    """Keep DNS and the outbound socket tied to the same verified public IP."""
    def __init__(self, host, address):
        super().__init__(host, 443, timeout=25, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, self.port), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


def public_https(url):
    try:
        parsed = urllib.parse.urlsplit(url)
        host = parsed.hostname
        if parsed.scheme != "https" or not host or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError
        resolved = {info[4][0] for info in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
        addresses = [ipaddress.ip_address(addr) for addr in resolved]
    except (OSError, ValueError) as exc:
        raise InvalidSource("The link did not return a downloadable video.") from exc
    if not addresses or any(not ip.is_global or ip.is_multicast or ip.is_reserved for ip in addresses):
        raise InvalidSource("The link did not return a downloadable video.")
    address = sorted(addresses, key=lambda ip: (ip.version, int(ip)))[0]
    target = urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
    return PinnedHTTPS(host, str(address)), target


def download(url, destination):
    started = time.monotonic()
    for _ in range(5):
        connection, target = public_https(url)
        try:
            connection.request("GET", target, headers={"User-Agent": "ClipFarm/1.0", "Accept-Encoding": "identity"})
            response = connection.getresponse()
            redirect = response.getheader("Location")
            if response.status in (301, 302, 303, 307, 308) and redirect:
                url = urllib.parse.urljoin(url, redirect)
                continue
            kind = response.getheader("Content-Type", "").split(";")[0].strip().lower()
            if response.status != 200 or not (kind.startswith("video/") or kind == "application/octet-stream"):
                break
            length = response.getheader("Content-Length")
            if length and length.isdigit() and int(length) > MAX_BYTES:
                raise InvalidSource("The source video must be 20 seconds to 60 minutes long and under 800 MB.")
            size = 0
            with destination.open("wb") as file:
                while data := response.read1(256 * 1024):
                    size += len(data)
                    if size > MAX_BYTES or time.monotonic() - started > 120:
                        raise InvalidSource("The source video must be 20 seconds to 60 minutes long and under 800 MB.")
                    file.write(data)
            return
        except (OSError, http.client.HTTPException) as exc:
            raise InvalidSource("The link did not return a downloadable video.") from exc
        finally:
            connection.close()
    raise InvalidSource("The link did not return a downloadable video.")


def probe(path):
    result = subprocess.run(["ffprobe", "-v", "error", *WHITELIST, "-show_streams", "-show_format",
                             "-of", "json", str(path)], check=True, capture_output=True, timeout=20)
    return json.loads(result.stdout)


def source_info(path):
    try:
        info = probe(path)
        duration = float(info["format"]["duration"])
        videos = [s for s in info["streams"] if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")]
        audios = [s for s in info["streams"] if s.get("codec_type") == "audio"]
        audio = max(audios, key=lambda s: ("original" in s.get("tags", {}).get("title", "").lower(),
                                          s.get("disposition", {}).get("original", 0), s.get("disposition", {}).get("default", 0)))
        video = videos[0]
    except (KeyError, ValueError, IndexError, subprocess.SubprocessError) as exc:
        raise InvalidSource("The source needs a video track and a readable audio track.") from exc
    if not 20 <= duration <= MAX_DURATION:
        raise InvalidSource("The source video must be 20 seconds to 60 minutes long and under 800 MB.")
    return duration, video["index"], audio["index"]


def ffmpeg(args, timeout=120, cwd=None):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-threads", "1", *args],
                   check=True, capture_output=True, timeout=timeout, cwd=cwd)


class EngineAPI:
    def __init__(self, callback, token):
        self.callback = callback
        self.token = token

    def call(self, path, data, method="POST", kind="application/json"):
        if kind == "application/json":
            data = json.dumps(data).encode()
        request = urllib.request.Request(f"{self.callback}/{path}", data=data, method=method,
                                         headers={"Authorization": f"Bearer {self.token}", "Content-Type": kind, "X-Clip-Length": str(len(data))})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise StageError(f"{path.split('/')[0]}_http_{exc.code}") from exc
        except (OSError, ValueError) as exc:
            raise StageError(f"{path.split('/')[0]}_unavailable") from exc


def transcript_segments(data, offset, duration):
    for segment in data.get("segments", []):
        try:
            a, b = float(segment["start"]), min(float(segment["end"]), duration)
            text = " ".join(segment["text"].split())[:2500]
        except (TypeError, KeyError, ValueError, AttributeError):
            continue
        if text and math.isfinite(a) and 0 <= a < b:
            yield (a + offset, b + offset, text)


def transcribe(source, duration, audio, work, api):
    segments = []
    for offset in range(0, math.ceil(duration), CHUNK_SECONDS):
        length = min(CHUNK_SECONDS, duration-offset)
        if length < .2:
            break
        track = work / "sample.mp3"
        ffmpeg(["-ss", str(offset), *WHITELIST, "-i", str(source), "-t", str(length), "-vn", "-map", f"0:{audio}",
                "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "40k", str(track)])
        data = api.call("transcribe", {"audio":base64.b64encode(track.read_bytes()).decode()})
        segments.extend(transcript_segments(data, offset, length))
    return sorted(segments)


def ranking_windows(segments):
    if not segments:
        return
    start = 0
    while start < len(segments):
        finish = start + 1
        while finish < len(segments) and segments[finish][0] - segments[start][0] <= 150:
            finish += 1
        if segments[finish-1][1] - segments[start][0] >= 19:
            yield start, finish
        if finish == len(segments):
            break
        next_start = finish
        while next_start > start + 1 and segments[finish][0] - segments[next_start-1][0] <= 35:
            next_start -= 1
        start = next_start


def options_for(segments, first, stop):
    """Only present clip lengths that we can actually cut."""
    options = []
    last_start = -100
    for i in range(first, stop):
        start = segments[i][0]
        if start-last_start < 8:
            continue
        endings = [j for j in range(i, stop) if 20 <= segments[j][1]-start <= 59]
        if not endings:
            continue
        best = min(endings, key=lambda j: abs(segments[j][1]-start-34) - (5 if segments[j][2].endswith((".", "!", "?")) else 0))
        end = segments[best][1]
        text = " ".join(item[2] for item in segments[i:best+1])
        options.append((start,end,text[:850]))
        last_start = start
    return options


def candidate(data, options):
    try:
        index = data["id"]
        score = float(data["score"])
        title = " ".join(data["title"].split())[:100]
        if type(index) is not int or not 0 <= index < len(options):
            return None
        start, end, _ = options[index]
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    if not 0 <= score <= 100 or not title:
        return None
    return (score, start, end, title)


def select_distinct(picks, count):
    chosen = []
    for pick in sorted(picks, key=lambda p: (-p[0], p[1])):
        _, start, end, _ = pick
        if any(min(end, other_end) - max(start, other_start) > 4 for _, other_start, other_end, _ in chosen):
            continue
        chosen.append(pick)
        if len(chosen) == count:
            break
    return chosen


def rank(segments, count, api):
    picks = []
    for first, stop in ranking_windows(segments):
        options = options_for(segments,first,stop)
        if not options:
            continue
        lines = "\n".join(f"[{i}] {end-start:.1f}s: {text}" for i,(start,end,text) in enumerate(options))
        response = api.call("rank", {"lines":lines[:28000], "count":min(4,count)})
        payload = response.get("result", response)
        if isinstance(payload, dict):
            payload = payload.get("response", payload)
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                continue
        outputs = payload.get("clips", []) if isinstance(payload, dict) else []
        if isinstance(outputs, list):
            picks.extend(pick for value in outputs[:6] if (pick := candidate(value, options)))
    return select_distinct(picks, count)


def timestamp(seconds):
    ticks = round(max(0, seconds)*1000)
    return f"{ticks//3600000:02}:{ticks//60000%60:02}:{ticks//1000%60:02},{ticks%1000:03}"


def caption_text(segments, start, end):
    entries = []
    for a,b,text in segments:
        a,b = max(a,start),min(b,end)
        if b-a < .12:
            continue
        text = re.sub(r"[{}<>]", "", text).replace("\\", "")
        lines = textwrap.wrap(text, width=27, break_long_words=True)
        groups = [lines[i:i+2] for i in range(0,len(lines),2)]
        for i, group in enumerate(groups):
            begin = a-start + (b-a)*i/len(groups)
            finish = a-start + (b-a)*(i+1)/len(groups)
            entries.append(f"{len(entries)+1}\n{timestamp(begin)} --> {timestamp(finish)}\n" + "\n".join(group))
    return "\n\n".join(entries)+"\n"


def render(source, work, video, audio, start, end, segments):
    (work/"captions.srt").write_text(caption_text(segments,start,end), encoding="utf-8")
    output = work/"output.mp4"
    # The full wide source remains visible so two-person shots retain context.
    graph = (
        f"[0:{video}]split[bg][fg];"
        "[bg]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=12:2,"
        "scale=720:1280,setsar=1,eq=brightness=-0.19[matte];"
        "[fg]scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[fit];"
        "[matte][fit]overlay=(W-w)/2:(H-h)/2,subtitles=captions.srt:"
        "force_style='FontName=DejaVu Sans,Fontsize=18,Bold=1,Outline=2,Shadow=0,MarginV=45'[clip]"
    )
    ffmpeg(["-ss",str(start),*WHITELIST,"-i",str(source),"-t",str(end-start),"-filter_complex_threads","1",
            "-filter_complex",graph,"-map","[clip]","-map",f"0:{audio}","-r","30","-c:v","libx264",
            "-threads","1","-preset","veryfast","-crf","22","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k",
            "-movflags","+faststart","-map_metadata","-1",str(output)],cwd=work)
    streams = probe(output)["streams"]
    if not any(s.get("codec_name") == "h264" and (s.get("width"),s.get("height")) == (720,1280) for s in streams):
        raise RuntimeError("Invalid portrait export")
    if not any(s.get("codec_name") == "aac" for s in streams):
        raise RuntimeError("Missing audio in export")
    return output


def process(source_url, count, work: Path, api):
    source = work/"source.media"
    download(source_url, source)
    duration, video, audio = source_info(source)
    segments = transcribe(source, duration, audio, work, api)
    picks = rank(segments, count, api)
    if not picks:
        raise InvalidSource("No usable spoken highlights were found.")
    clips = []
    for _, start, end, title in picks:
        try:
            output = render(source,work,video,audio,start,end,segments)
        except (subprocess.SubprocessError, RuntimeError):
            continue
        index = len(clips) + 1
        api.call(f"asset/{index}", output.read_bytes(), method="PUT", kind="video/mp4")
        clips.append({"index":index,"title":title,"duration":round(end-start,2)})
    return clips
