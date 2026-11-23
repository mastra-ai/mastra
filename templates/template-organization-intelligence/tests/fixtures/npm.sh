#!/bin/sh
printf '%s\n' "$*" >> "$BOOTSTRAP_LOG"
if [ "$BOOTSTRAP_FAIL" = install ] && { [ "$1" = ci ] || [ "$1" = install ]; }; then exit 17; fi
if [ "$1" = install ]; then printf '{"lockfileVersion":3}\n' > package-lock.json; fi
if [ "$BOOTSTRAP_FAIL" = dev ] && [ "$1" = run ]; then exit 19; fi
exit 0
