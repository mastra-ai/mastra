Packages: `mastracode/sdk` (`@mastra/code-sdk`), `mastracode/tui` (`mastracode`), `mastracode/factory-ui` (`@internal/factory-ui`), and standalone `mastracode/web`. Scope commands to the changed package.

TUI: build deps with `pnpm build:mastracode`; test SDK+TUI with `pnpm test:mastracode`; typecheck with `pnpm --filter ./mastracode/tui check`; lint with `pnpm --filter ./mastracode/tui lint`. Build first before broad tests.

Focused TUI test: `pnpm --filter ./mastracode/tui exec vitest run <test-file> --reporter=dot --bail 1`.

Factory UI is the independent React SPA and CLI UI artifact; see `mastracode/factory-ui/AGENTS.md`.

Tests are colocated in package `src`. TUI scenarios: `mastracode/tui/e2e/tui/`; fixtures: `mastracode/tui/e2e/fixtures/`. Use `e2e:list`, `e2e:smoke`, or `e2e:test -- --reporter=dot`; focus with `MC_E2E_VITEST_SCENARIOS=<scenario> pnpm --filter ./mastracode/tui exec vitest run --config e2e/vitest.config.ts --reporter=dot`.

Use `testing-mastracode-tui` for interactive guidance and `mastracode/tui/e2e/README.md` for runner commands. TUI-visible behavior needs checked-in TUI E2E coverage. Sanitize any read-only local Application Support data into deterministic AIMock fixtures.
