#!/bin/sh
set -eu
for file in /proc/[0-9]*/cmdline; do
  test -r "$file" || continue
  executable=$(tr '\000' '\n' < "$file" 2>/dev/null | head -n 1) || continue
  case "$executable" in
    *chromium*|*/leakless) printf 'PROCESS\000'; cat "$file" 2>/dev/null || true; printf '\000' ;;
  esac
done
