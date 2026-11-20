#!/bin/sh
stage=$(basename "$0")
printf '%s\n' "$stage" >> "$CHECK_LOG"
if [ "$CHECK_FAIL_STAGE" = "$stage" ]; then exit 23; fi
