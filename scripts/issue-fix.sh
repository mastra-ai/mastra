set -e

claude --dangerously-skip-permissions "@.planning/issues.md @progress.txt \
1. Find the highest-priority issue to work on and work only on that issue. \
   This should be the one YOU decide has the highest priority — not necessarily the first. \
2. First create a test that reproduces the issue. \
3. Then create a plan to fix the issue. \
4. Check that the types check via pnpm typecheck and that the tests pass via pnpm test. \
3. Update the issue summary with the work that was done. \
4. Append your progress to the progress.txt file. \
   Use this to leave a note for the next person working in the codebase. \
ONLY WORK ON A SINGLE ISSUE. \
If, while implementing the issue, you notice the issue is complete, output <promise>COMPLETE</promise>.
"