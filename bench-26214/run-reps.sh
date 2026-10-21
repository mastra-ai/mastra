cd /workspace/bench
while pgrep -f "[r]un-matrix2.sh pg 1" >/dev/null; do sleep 5; done
for REP in 2 3; do
  bash run-matrix2.sh libsql $REP "1000x2000 1000x32000 5000x2000 5000x32000 1000x256000"
  bash run-matrix2.sh pg $REP "1000x2000 1000x32000 5000x2000"
done
# Re-measure the PR's original 400-item table (tiny outputs, concurrency 4) on LibSQL.
for V in main pr coalesce; do ./bench-case.sh $V libsql 400 10 4 /workspace/bench/results-400.jsonl 300; done
echo ALLDONE >> /workspace/bench/matrix-libsql.log
