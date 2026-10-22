#!/bin/bash
cd /workspace/mastra/workflows/inngest
out=/workspace/bench/inngest.out; : > $out
for f in $(ls src/*.test.ts src/__tests__/*.test.ts src/durable-agent/*.test.ts); do
  n=$(basename $f .test.ts)
  NODE_OPTIONS=--max-old-space-size=2048 timeout 300 npx vitest run $f --no-isolate --retry=1 > /tmp/i-$n.log 2>&1; rc=$?
  echo "$n rc=$rc $(sed 's/\x1b\[[0-9;]*m//g' /tmp/i-$n.log | grep -E 'Tests ' | tail -1 | tr -s ' ') $(grep -c 'heap out of memory' /tmp/i-$n.log)oom" >> $out
done
echo INNGESTDONE >> $out
