#!/usr/bin/env python3
"""Turn a marked GitHub issue into one guestbook markdown file."""
from __future__ import print_function

import json
import os
import re
import sys
from datetime import datetime, timezone

MARKER = "LOOKGOOD_GUESTBOOK_V1"
MAX_NAME = 40
MAX_MESSAGE = 500


def sanitize(value, max_len):
    text = "" if value is None else str(value)
    text = re.sub(r"<[^>]*>", "", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def yaml_quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def parse_issue(title, body):
    if not str(title or "").strip().startswith("[guestbook]"):
        return None
    body = str(body or "").replace("\r\n", "\n").strip()
    if not body.startswith(MARKER):
        return None
    rest = body[len(MARKER) :].strip()
    try:
        data = json.loads(rest)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    name = sanitize(data.get("name"), MAX_NAME)
    message = sanitize(data.get("message"), MAX_MESSAGE)
    if not name or not message:
        return None
    return {"name": name, "message": message}


def pacific_stamp(iso_time):
    try:
        from zoneinfo import ZoneInfo

        dt = datetime.fromisoformat(str(iso_time).replace("Z", "+00:00"))
        dt = dt.astimezone(ZoneInfo("America/Los_Angeles"))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S %z"), dt.strftime("%Y-%m-%d-%H%M%S")


def build_entry(name, message, created_at, issue_number):
    date_yaml, date_file = pacific_stamp(created_at)
    number = re.sub(r"[^0-9]", "", str(issue_number) or "0") or "0"
    filename = "_guestbook/%s-%s.md" % (date_file, number)
    content = "\n".join(
        [
            "---",
            "name: " + yaml_quote(name),
            "message: " + yaml_quote(message),
            "date: " + yaml_quote(date_yaml),
            "---",
            "",
        ]
    )
    return filename, content


def main():
    parsed = parse_issue(os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", ""))
    if not parsed:
        print("skip: not a guestbook signature")
        return 0
    filename, content = build_entry(
        parsed["name"],
        parsed["message"],
        os.environ.get("ISSUE_TIME", ""),
        os.environ.get("ISSUE_NUMBER", "0"),
    )
    os.makedirs("_guestbook", exist_ok=True)
    with open(filename, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("wrote", filename)
    return 0


if __name__ == "__main__":
    sys.exit(main())
