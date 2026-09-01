#!/usr/bin/env python3
"""Turn a marked GitHub issue into a public missed-connection note.

Contact fields stay in the GitHub issue and are never written to the site files.
Replies are left as open issues for the admin inbox.
"""
from __future__ import print_function

import json
import os
import re
import sys
from datetime import datetime, timezone

POST_MARKER = "LOOKGOOD_MISSED_V1"
REPLY_MARKER = "LOOKGOOD_MISSED_REPLY_V1"
MAX_NAME = 40
MAX_NIGHT = 80
MAX_YOU = 200
MAX_ME = 200
MAX_NOTE = 400
MAX_CONTACT = 80

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+", re.I)
URL_RE = re.compile(r"https?://\S+", re.I)
HANDLE_RE = re.compile(r"(^|[\s(])@([A-Za-z0-9._]{2,30})")
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[\s.\-]*)?(?:\(?\d{3}\)?[\s.\-]*)\d{3}[\s.\-]*\d{4}(?!\d)"
)


def sanitize(value, max_len):
    text = "" if value is None else str(value)
    text = re.sub(r"<[^>]*>", "", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def redact_public(value, max_len):
    text = sanitize(value, max_len * 2)
    text = EMAIL_RE.sub("[off the board]", text)
    text = URL_RE.sub("[off the board]", text)
    text = PHONE_RE.sub("[off the board]", text)
    text = HANDLE_RE.sub(r"\1[off the board]", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def yaml_quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_bool(value):
    return "true" if value else "false"


def parse_marked_json(body, marker):
    body = str(body or "").replace("\r\n", "\n").strip()
    if not body.startswith(marker):
        return None
    rest = body[len(marker) :].strip()
    try:
        data = json.loads(rest)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return data


def parse_issue(title, body):
    title = str(title or "").strip()
    if not title.startswith("[missed]"):
        return None
    reply = parse_marked_json(body, REPLY_MARKER)
    if reply is not None:
        post = re.sub(r"[^0-9]", "", str(reply.get("post") or ""))
        name = sanitize(reply.get("name"), MAX_NAME)
        note = sanitize(reply.get("note"), MAX_NOTE)
        contact = sanitize(reply.get("contact"), MAX_CONTACT)
        if not post or not name or not note or not contact:
            return None
        return {
            "kind": "reply",
            "post": post,
            "name": name,
            "note": note,
            "contact": contact,
        }
    post = parse_marked_json(body, POST_MARKER)
    if post is None:
        return None
    name = redact_public(post.get("name"), MAX_NAME)
    night = redact_public(post.get("night"), MAX_NIGHT)
    you = redact_public(post.get("you"), MAX_YOU)
    me = redact_public(post.get("me"), MAX_ME)
    note = redact_public(post.get("note"), MAX_NOTE)
    contact = sanitize(post.get("contact"), MAX_CONTACT)
    if not name or not (you or me or note):
        return None
    return {
        "kind": "post",
        "name": name,
        "night": night,
        "you": you,
        "me": me,
        "note": note,
        "has_contact": bool(contact),
    }


def pacific_stamp(iso_time):
    try:
        from zoneinfo import ZoneInfo

        dt = datetime.fromisoformat(str(iso_time).replace("Z", "+00:00"))
        dt = dt.astimezone(ZoneInfo("America/Los_Angeles"))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S %z"), dt.strftime("%Y-%m-%d-%H%M%S")


def build_entry(parsed, created_at, issue_number):
    date_yaml, date_file = pacific_stamp(created_at)
    number = re.sub(r"[^0-9]", "", str(issue_number) or "0") or "0"
    filename = "_missed/%s-%s.md" % (date_file, number)
    content = "\n".join(
        [
            "---",
            "name: " + yaml_quote(parsed["name"]),
            "night: " + yaml_quote(parsed.get("night") or ""),
            "you: " + yaml_quote(parsed.get("you") or ""),
            "me: " + yaml_quote(parsed.get("me") or ""),
            "note: " + yaml_quote(parsed.get("note") or ""),
            "number: " + number,
            "has_contact: " + yaml_bool(parsed.get("has_contact")),
            "date: " + yaml_quote(date_yaml),
            "---",
            "",
        ]
    )
    return filename, content


def main():
    parsed = parse_issue(os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", ""))
    if not parsed:
        print("skip: not a missed connection")
        return 0
    if parsed["kind"] == "reply":
        print("inbox: private reply to #%s (not written to the site)" % parsed["post"])
        return 0
    filename, content = build_entry(
        parsed,
        os.environ.get("ISSUE_TIME", ""),
        os.environ.get("ISSUE_NUMBER", "0"),
    )
    os.makedirs("_missed", exist_ok=True)
    with open(filename, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("wrote", filename)
    return 0


if __name__ == "__main__":
    sys.exit(main())
