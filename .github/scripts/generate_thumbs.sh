#!/usr/bin/env bash
# Create 320px thumbs for any full-size gallery photo that does not have one yet.
set -euo pipefail
shopt -s globstar nullglob

made=0

for f in img/**/full/*.{jpg,JPG,jpeg,JPEG,png,PNG}; do
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  parent="$(dirname "$dir")"
  thumbdir="$parent/thumbs"
  thumb="$thumbdir/$base"

  mkdir -p "$thumbdir"

  if [ ! -f "$thumb" ]; then
    convert "$f" -auto-orient -strip -resize 320x -quality 72 "$thumb"
    echo "Made $thumb"
    made=1
  fi
done

if [ "$made" -eq 0 ]; then
  echo "No new thumbs needed."
fi
