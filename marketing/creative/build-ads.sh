#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
regular=${CLIPFARM_FONT_REGULAR:-/System/Library/Fonts/Supplemental/Arial.ttf}
bold=${CLIPFARM_FONT_BOLD:-/System/Library/Fonts/Supplemental/Arial Bold.ttf}

magick key-visual.jpg -resize '1080x1350^' -gravity center -extent 1080x1350 \
  -gravity northwest -font "$bold" -fill '#d2fb55' -pointsize 29 -annotate +78+81 'CLIPFARM' \
  -fill '#fffdf2' -pointsize 86 -annotate +73+179 'Find the good parts.' \
  -font "$regular" -pointsize 31 -annotate +78+1193 'Paste a video link. Pick your clip count.' \
  -font "$bold" -fill '#d2fb55' -pointsize 27 -annotate +78+1246 'MAKE CLIPS  ›' -strip -quality 92 feed-1080x1350.jpg

magick key-visual.jpg -resize 1080x -background '#10120f' -gravity center -extent 1080x1920 \
  -gravity northwest -font "$bold" -fill '#d2fb55' -pointsize 35 -annotate +93+282 'CLIPFARM' \
  -fill '#fffdf2' -pointsize 99 -annotate +88+379 'One video.' \
  -fill '#d2fb55' -annotate +88+478 'Better shorts.' \
  -font "$regular" -fill '#fffdf2' -pointsize 37 -annotate +93+1438 'Paste a link. Pick your clip count.' \
  -font "$bold" -fill '#d2fb55' -pointsize 32 -annotate +93+1502 'MAKE CLIPS  ›' -strip -quality 92 story-1080x1920.jpg
