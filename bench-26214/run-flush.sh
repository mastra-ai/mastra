#!/bin/bash
cd /workspace/mastra/packages/core
for rep in 1 2 3; do for c in 1 10; do for iv in 1000 0; do
  BENCH_STORE=libsql BENCH_N=1000 BENCH_SIZE=2000 BENCH_C=$c BENCH_INTERVAL_MS=$iv BENCH_LABEL=flush-iv$iv BENCH_OUT=/workspace/bench/results-flush.jsonl NODE_OPTIONS=--max-old-space-size=2048 \
    timeout 600 npx vitest run src/workflows/bench-26214.test.ts --maxWorkers=1 --typecheck.enabled=false > /tmp/bench-last.log 2>&1
  echo "rep=$rep c=$c iv=$iv rc=$?" >> /workspace/bench/flush.log
done; done; done
echo FLUSHDONE >> /workspace/bench/flush.log
