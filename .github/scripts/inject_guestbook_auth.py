#!/usr/bin/env python3
"""Write guestbook-auth.js for the Pages build. Never print the token."""
import json
import os
from pathlib import Path

token = os.environ.get("GUESTBOOK_TOKEN") or ""
path = Path("assets/js/guestbook-auth.js")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(
    "window.LOOKGOOD_GUESTBOOK_AUTH = " + json.dumps(token) + ";\n",
    encoding="utf-8",
)
print("guestbook auth:", "present" if token else "empty")
