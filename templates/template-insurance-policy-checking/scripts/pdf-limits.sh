#!/bin/sh
# Apply CPU and core-dump limits, then replace this shell with the given argv.
# Arguments are positional parameters; they are not concatenated into this script.
ulimit -c 0
ulimit -t 10
exec "$@"
