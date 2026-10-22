#!/bin/bash
cd /workspace/mastra/packages/core
out=/workspace/bench/durable.out; : > $out
for f in src/agent/durable/__tests__/*.test.ts; do
  n=$(basename $f .test.ts)
  NODE_OPTIONS=--max-old-space-size=2048 timeout 300 npx vitest run $f --maxWorkers=1 > /tmp/d-$n.log 2>&1; rc=$?
  echo "$n rc=$rc $(sed 's/\x1b\[[0-9;]*m//g' /tmp/d-$n.log | grep -E 'Tests ' | tail -1 | tr -s ' ') $(grep -c 'heap out of memory' /tmp/d-$n.log)oom" >> $out
done
echo DURABLEDONE >> $out
