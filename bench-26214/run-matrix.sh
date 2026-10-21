# usage: run-matrix.sh <store> <rep>
S=$1; REP=$2; O=/workspace/bench/results-$S.jsonl; B=/workspace/bench
for case in "1000 2000" "1000 32000" "5000 2000" "5000 32000" "1000 256000"; do
  set -- $case; N=$1; SZ=$2
  for C in 1 10; do
    for V in main coalesce pr; do
      # PR as-is rewrites every finished output per item (~N^2/2 x size): one c=1 attempt only for the huge cases.
      if [ $V = pr ] && { [ "$case" = "5000 32000" ] || [ "$case" = "1000 256000" ]; } && { [ $C = 10 ] || [ $REP != 1 ]; }; then continue; fi
      T=600; [ $V = pr ] && T=240
      $B/bench-case.sh $V $S $N $SZ $C $O $T
      echo "rep=$REP $V $S $N $SZ c=$C rc=$?" >> $B/matrix-$S.log
    done
  done
done
echo "DONE rep=$REP" >> $B/matrix-$S.log
