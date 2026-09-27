#!/bin/sh
printf '%s\n' "$*" >> "$BOOTSTRAP_LOG"
if [ "$BOOTSTRAP_FAIL" = install ] && [ "$1" = ci ]; then exit 17; fi
if [ "$BOOTSTRAP_FAIL" = dev ] && [ "$1" = run ]; then exit 19; fi
exit 0
