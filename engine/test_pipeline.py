import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline import InvalidSource, candidate, caption_text, options_for, public_https, ranking_windows, select_distinct, transcript_segments


class SelectionTests(unittest.TestCase):
    def test_selection_uses_source_ids_and_drops_overlaps(self):
        segments = [(i*5, i*5+4, f"Line {i}.") for i in range(80)]
        self.assertGreater(len(list(ranking_windows(segments))), 1)
        options = options_for(segments, 0, 10)
        best = candidate(dict(id=0, score=95, title="A good cut"), options)
        self.assertEqual(best, (95, 0, 34, "A good cut"))
        self.assertIsNone(candidate(dict(id=15, score=95, title="An invented cut"), options))
        self.assertEqual(select_distinct([best, (90, 4, 29, "Overlap"), (80, 32, 57, "Distinct")], 3),
                         [best, (80, 32, 57, "Distinct")])

    def test_caption_offset_and_chunk_duration(self):
        data = {"segments":[{"start":0.25,"end":30,"text":"A real sentence."}]}
        segments = list(transcript_segments(data,300,20))
        self.assertEqual(segments,[(300.25,320,"A real sentence.")])
        self.assertIn("00:00:00,250 --> 00:00:17,000",caption_text(segments,300,317))

    @patch("pipeline.socket.getaddrinfo", return_value=[(None,None,None,None,("10.0.0.1",443))])
    def test_source_rejects_private_resolution(self, _lookup):
        with self.assertRaises(InvalidSource):
            public_https("https://video.example.org/asset.mp4")


class CreditTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript((Path(__file__).parent.parent/"migrations/0001_initial.sql").read_text())
        self.db.execute("INSERT INTO accounts VALUES ('a','a@example.test','hash',500)")

    def balance(self):
        return self.db.execute("SELECT balance FROM accounts WHERE id='a'").fetchone()[0]

    def test_reserves_and_refunds_only_undelivered_clips(self):
        self.db.execute("INSERT INTO jobs(id,account_id,source,requested,created_at,updated_at) VALUES ('job','a','https://video.example/a',5,0,0)")
        self.assertEqual(self.balance(),0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO jobs(id,account_id,source,requested,created_at,updated_at) VALUES ('second','a','https://video.example/a',1,0,0)")
        self.db.execute("UPDATE jobs SET status='complete',asset_count=3 WHERE id='job'")
        self.assertEqual(self.balance(),200)
        self.db.execute("UPDATE jobs SET status='complete' WHERE id='job'")
        self.assertEqual(self.balance(),200)

    def test_webhook_redelivery_adds_pack_once(self):
        for _ in range(2):
            self.db.execute("INSERT INTO purchases VALUES ('stripe-session','a',3000,0) ON CONFLICT(session_id) DO NOTHING")
        self.assertEqual(self.balance(),3500)
