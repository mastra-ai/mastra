#!/usr/bin/env bash
# Runs the paired arms back to back on the disposable container only.
# Usage: run-pair.sh <mode> <outage-s> <label-prefix> [caches...]
set -u
MODE=${1:-plain}
OUTAGE=${2:-300}
PREFIX=${3:-P2}
shift 3 || true
CACHES=${*:-memory redis}
HERE=$(cd "$(dirname "$0")" && pwd)
RUNS="$HERE/../runs"
for c in $CACHES; do
  label="$PREFIX-$MODE-$c"
  mkdir -p "$RUNS/$label"
  docker unpause cor1527-redis >/dev/null 2>&1 || true
  docker exec cor1527-redis redis-cli FLUSHALL >/dev/null
  echo "[$(date -u +%FT%TZ)] start $label"
  node "$HERE/harness.mjs" --mode="$MODE" --cache="$c" --pre-s=5 --outage-s="$OUTAGE" --post-s=15 --drain-s=240 --label="$label" \
    >"$RUNS/$label/console.log" 2>&1
  echo "[$(date -u +%FT%TZ)] exit $label code=$?"
  tail -1 "$RUNS/$label/console.log"
done
docker unpause cor1527-redis >/dev/null 2>&1 || true
echo "[$(date -u +%FT%TZ)] pair done"
