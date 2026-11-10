Packages: `mastracode/sdk` (`@mastra/code-sdk`), `mastracode/tui` (`mastracode`), `mastracode/factory-ui` (`@internal/factory-ui`), and standalone `mastracode/web`. Scope commands to the changed package.

TUI: build deps with `pnpm build:mastracode`; test SDK+TUI with `pnpm test:mastracode`; typecheck with `pnpm --filter ./mastracode/tui check`; lint with `pnpm --filter ./mastracode/tui lint`. Build first before broad tests.

Focused TUI test: `pnpm --filter ./mastracode/tui exec vitest run <test-file> --reporter=dot --bail 1`.

Factory (`mastracode/factory`, `@mastra/factory`): the full suite is too slow for a foreground sandbox command, so verify with focused runs. Run the colocated test files for what you changed in the foreground: `pnpm --filter ./mastracode/factory exec vitest run <test-files> --reporter=dot --bail 1` (a single file takes a few seconds). Broad runs, like the full `test` script, whole `src/integrations`/`src/rules` directories, `vitest related`, or `vitest run --changed`, can fan out to most of the suite, so run them as a background process and poll, or leave them to CI. Typecheck with `pnpm --filter ./mastracode/factory check`.

Factory UI is the independent React SPA and CLI UI artifact; see `mastracode/factory-ui/AGENTS.md`.

Tests are colocated in package `src`. TUI scenarios: `mastracode/tui/e2e/tui/`; fixtures: `mastracode/tui/e2e/fixtures/`. Use `e2e:list`, `e2e:smoke`, or `e2e:test -- --reporter=dot`; focus with `MC_E2E_VITEST_SCENARIOS=<scenario> pnpm --filter ./mastracode/tui exec vitest run --config e2e/vitest.config.ts --reporter=dot`.

Use `testing-mastracode-tui` for interactive guidance and `mastracode/tui/e2e/README.md` for runner commands. TUI-visible behavior needs checked-in TUI E2E coverage. Sanitize any read-only local Application Support data into deterministic AIMock fixtures.
