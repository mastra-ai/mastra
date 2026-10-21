cd /workspace/mastra/packages/core
O=/workspace/bench/tests.out; : > $O
r(){ NODE_OPTIONS=--max-old-space-size=2048 timeout 600 npx vitest run src/workflows/$1.test.ts --maxWorkers=1 --typecheck.enabled=false ${2:+-t "$2"} > /tmp/t.log 2>&1; echo "$1${3:+[$3]} exit=$? $(grep -a 'Tests ' /tmp/t.log | tail -1) oom=$(grep -ac heap /tmp/t.log) $(grep -a '×' /tmp/t.log | head -3 | tr '\n' ' ')" >> $O; }
for p in src/workflows/*.test.ts; do f=$(basename $p .test.ts); case $f in workflow|bench-26214) continue;; esac; r $f; done
X='Suspend and Resume|Time travel|> restart|> foreach|Nested workflows|Loops|perStep'
Y1='Basic Workflow|if-else|callbacks|error handling|Error Handling|Clone|Complex Conditions|Dependency|Simple Conditions'
Y2='Variable Resolution|Schema Validation|Retry|Run Count|Storage Persistence|Workflow Runs|getWorkflow|Streaming|streaming execution'
r workflow 'Suspend and Resume' A; r workflow 'Time travel|> restart|> foreach|Nested workflows|Loops|perStep' B; r workflow "$Y1" D1; r workflow "$Y2" D2; r workflow "^(?!.*($X|$Y1|$Y2))" C2
echo DONE >> $O
