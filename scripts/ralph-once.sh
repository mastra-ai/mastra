set -e

claude --dangerously-skip-permissions "@plans/prd.json @progress.txt \
1. Find the highest-priority feature to work on and work only on that feature. \
   This should be the one YOU decide has the highest priority — not necessarily the first. \
2. Check that the types check via pnpm typecheck and that the E2E tests pass via: cd packages/playground/e2e && CI=true npx playwright test -c playwright.config.ts \
3. Update the PRD with the work that was done. \
4. Append your progress to the progress.txt file. \
   Use this to leave a note for the next person working in the codebase. \
5. Make a git commit of that feature. \
ONLY WORK ON A SINGLE FEATURE. \
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>.
"