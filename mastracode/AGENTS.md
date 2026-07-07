Build from root: pnpm build:mastracode
Test from root: pnpm test:mastracode
Typecheck from root: pnpm --filter ./mastracode check
Lint from root: pnpm --filter ./mastracode lint

Run pnpm build:mastracode before broad Mastra Code test audits so workspace dependency dist artifacts are available.
For focused tests, prefer pnpm --filter ./mastracode exec vitest run <test-file> --reporter=dot --bail 1 before the full package suite.

Most unit tests live under mastracode/src/ and are colocated with the code they cover.
Run focused agent, model, headless, TUI, command, MCP, plugin, or processor tests before broader validation when those areas change.

Mastra Code TUI/e2e scenarios live under mastracode/e2e/tui/ with fixtures in mastracode/e2e/fixtures/.
List scenarios with pnpm --filter ./mastracode run e2e:list.
Run smoke scenarios with pnpm --filter ./mastracode run e2e:smoke.
For focused scenario development, use MC_E2E_VITEST_SCENARIOS=<scenario> pnpm --filter ./mastracode exec vitest run --config e2e/vitest.config.ts --reporter=dot.
Run pnpm --filter ./mastracode run e2e:test -- --reporter=dot before shipping runner changes.

For Mastra Code TUI work, use the testing-mastracode-tui skill for interactive/manual testing guidance, but prefer mastracode/e2e/README.md as the source of truth for runner commands.

TUI-visible or TUI-triggered behavior should have checked-in TUI e2e coverage; lower-level tests are supporting shields, not substitutes.
If realistic long conversation or OM fixture data is needed, read the local Mastra Code Application Support database only via read-only operations, sanitize it, and transform it into deterministic AIMock-compatible fixtures.

Keep changes here surgical; Mastra Code exercises core harness, storage, memory, tools, MCP, browser, plugins, signals, and TUI integration paths.
