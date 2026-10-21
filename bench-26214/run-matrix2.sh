# usage: run-matrix2.sh <store> <rep> "<NxSIZE> ..."  (main vs coalesce only)
S=$1; REP=$2; O=/workspace/bench/results-$S.jsonl; B=/workspace/bench
for case in $3; do
  N=${case%x*}; SZ=${case#*x}
  for C in 1 10; do
    for V in main coalesce; do
      $B/bench-case.sh $V $S $N $SZ $C $O 600
      echo "rep=$REP $V $S $N $SZ c=$C rc=$?" >> $B/matrix-$S.log
    done
  done
done
echo "DONE $S rep=$REP" >> $B/matrix-$S.log
