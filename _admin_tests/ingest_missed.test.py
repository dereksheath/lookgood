#!/usr/bin/env python3
"""Tests for missed-connection ingest: public board, private contact."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github" / "scripts" / "ingest_missed.py"

spec = importlib.util.spec_from_file_location("ingest_missed", SCRIPT)
missed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(missed)


class IngestMissedTests(unittest.TestCase):
    def test_contact_stays_out_of_the_public_file(self):
        body = (
            "LOOKGOOD_MISSED_V1\n"
            '{"name":"Sam","night":"2008 Night","you":"sequin top",'
            '"me":"striped shirt","note":"great laugh",'
            '"contact":"@secret.person"}'
        )
        parsed = missed.parse_issue("[missed]", body)
        self.assertEqual(parsed["kind"], "post")
        self.assertTrue(parsed["has_contact"])
        self.assertNotIn("contact", parsed)
        filename, content = missed.build_entry(parsed, "2026-08-29T19:17:54Z", "12")
        self.assertTrue(filename.startswith("_missed/"))
        self.assertTrue(filename.endswith("-12.md"))
        self.assertIn('name: "Sam"', content)
        self.assertIn("has_contact: true", content)
        self.assertIn("number: 12", content)
        self.assertNotIn("secret.person", content)
        self.assertNotIn("@secret", content)
        self.assertNotIn("\ncontact:", content)

    def test_redacts_emails_phones_handles_and_urls_from_the_board(self):
        body = (
            "LOOKGOOD_MISSED_V1\n"
            '{"name":"Sam","night":"2008 Night",'
            '"you":"email me at sam@example.com please",'
            '"me":"call 555-123-4567",'
            '"note":"ig @findme now https://example.com/x",'
            '"contact":"sam@example.com"}'
        )
        parsed = missed.parse_issue("[missed]", body)
        self.assertEqual(parsed["you"], "email me at [off the board] please")
        self.assertEqual(parsed["me"], "call [off the board]")
        self.assertIn("[off the board]", parsed["note"])
        self.assertNotIn("sam@example.com", parsed["you"])
        self.assertNotIn("555-123-4567", parsed["me"])
        self.assertNotIn("@findme", parsed["note"])
        _, content = missed.build_entry(parsed, "2026-08-29T19:17:54Z", "3")
        self.assertNotIn("sam@example.com", content)
        self.assertNotIn("555-123-4567", content)

    def test_reply_is_inbox_only(self):
        body = (
            "LOOKGOOD_MISSED_REPLY_V1\n"
            '{"post":"12","name":"Alex","note":"I had the sequin top",'
            '"contact":"@alex"}'
        )
        parsed = missed.parse_issue("[missed] reply 12", body)
        self.assertEqual(parsed["kind"], "reply")
        self.assertEqual(parsed["post"], "12")
        self.assertEqual(parsed["contact"], "@alex")

    def test_guestbook_and_empty_payloads_are_skipped(self):
        self.assertIsNone(missed.parse_issue("[guestbook]", "LOOKGOOD_GUESTBOOK_V1\n{}"))
        self.assertIsNone(missed.parse_issue("[missed]", "nope"))
        self.assertIsNone(
            missed.parse_issue(
                "[missed]",
                'LOOKGOOD_MISSED_V1\n{"name":"","you":"","me":"","note":"","contact":"x"}',
            )
        )

    def test_main_writes_posts_and_skips_replies(self):
        env = {
            "ISSUE_TITLE": "[missed]",
            "ISSUE_BODY": (
                "LOOKGOOD_MISSED_V1\n"
                '{"name":"Sam","night":"2008 Night","you":"blue jacket",'
                '"me":"","note":"by the patio","contact":"sam@hide.me"}'
            ),
            "ISSUE_TIME": "2026-08-29T19:17:54Z",
            "ISSUE_NUMBER": "9",
        }
        with tempfile.TemporaryDirectory() as tmp:
            old = os.getcwd()
            os.chdir(tmp)
            try:
                for key, value in env.items():
                    os.environ[key] = value
                self.assertEqual(missed.main(), 0)
                files = list(Path("_missed").glob("*.md"))
                self.assertEqual(len(files), 1)
                text = files[0].read_text(encoding="utf-8")
                self.assertIn("blue jacket", text)
                self.assertNotIn("sam@hide.me", text)

                os.environ["ISSUE_TITLE"] = "[missed] reply 9"
                os.environ["ISSUE_BODY"] = (
                    'LOOKGOOD_MISSED_REPLY_V1\n{"post":"9","name":"A",'
                    '"note":"it was me","contact":"@a"}'
                )
                self.assertEqual(missed.main(), 0)
                self.assertEqual(len(list(Path("_missed").glob("*.md"))), 1)
            finally:
                os.chdir(old)


if __name__ == "__main__":
    unittest.main()
