#!/bin/bash
# usage: bench-case.sh <variant> <store> <n> <size> <c> <out> [timeout]
# variant: main | pr | coalesce
set -u
V=$1; S=$2; N=$3; SZ=$4; C=$5; OUT=$6; T=${7:-300}
cd /workspace/mastra
case $V in
  main) REV=ffda90fdba ;;
  pr) REV=fca916bb71 ;;
  coalesce) REV=00d9e0b603 ;;
esac
git checkout -q $REV -- packages/core/src/workflows
rm -f /tmp/bench-26214.db* /tmp/bench-partial.json
cd packages/core
BENCH_STORE=$S BENCH_N=$N BENCH_SIZE=$SZ BENCH_C=$C BENCH_LABEL=$V BENCH_OUT=$OUT NODE_OPTIONS=--max-old-space-size=2048 \
  timeout $T npx vitest run src/workflows/bench-26214.test.ts --maxWorkers=1 --typecheck.enabled=false > /tmp/bench-last.log 2>&1
rc=$?
if [ $rc -ne 0 ]; then
  reason=$(grep -aom1 "heap out of memory\|run ended [a-z]*\|Error: [^\n]*" /tmp/bench-last.log | head -1 | cut -c1-120)
  cp /tmp/bench-last.log /workspace/bench/dnf-$V-$S-$N-$SZ-$C.log; partial=$(cat /tmp/bench-partial.json 2>/dev/null || echo "{}")
  echo "{\"label\":\"$V\",\"store\":\"$S\",\"n\":$N,\"size\":$SZ,\"c\":$C,\"dnf\":true,\"exit\":$rc,\"reason\":\"${reason//\"/}\",\"partial\":$partial}" >> $OUT
fi
cd /workspace/mastra && git checkout -q HEAD -- packages/core/src/workflows
exit $rc
