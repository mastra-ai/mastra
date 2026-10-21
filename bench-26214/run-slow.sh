cd /workspace/bench
until grep -q ALLDONE matrix-libsql.log; do sleep 5; done
# Slow items: coalescing is bounded per second, not per item, so long foreach runs still rewrite progress ~1/s.
export BENCH_DELAY_MS=100
for S in libsql pg; do
  for V in main coalesce; do ./bench-case.sh $V $S 300 32000 1 /workspace/bench/results-slow.jsonl 300; done
done
export BENCH_DELAY_MS=1000
for S in libsql pg; do
  for V in main coalesce; do ./bench-case.sh $V $S 100 32000 10 /workspace/bench/results-slow.jsonl 300; done
done
echo SLOWDONE >> matrix-libsql.log
