Mastra Code is split into `mastracode/sdk` (`@mastra/code-sdk`), `mastracode/tui` (`mastracode`), and the standalone `mastracode/web` project. Scope package commands to the package being changed.

Build the TUI and its dependency graph from root: pnpm build:mastracode
Test SDK and TUI from root: pnpm test:mastracode
Typecheck TUI from root: pnpm --filter ./mastracode/tui check
Lint TUI from root: pnpm --filter ./mastracode/tui lint

Run pnpm build:mastracode before broad Mastra Code test audits so workspace dependency dist artifacts are available.
For focused TUI tests, prefer pnpm --filter ./mastracode/tui exec vitest run <test-file> --reporter=dot --bail 1 before the full package suite.

Most unit tests live under `mastracode/sdk/src` or `mastracode/tui/src` and are colocated with the code they cover.
Run focused agent, model, headless, TUI, command, MCP, plugin, or processor tests in the owning package before broader validation when those areas change.

Mastra Code TUI/e2e scenarios live under mastracode/tui/e2e/tui/ with fixtures in mastracode/tui/e2e/fixtures/.
List scenarios with pnpm --filter ./mastracode/tui run e2e:list.
Run smoke scenarios with pnpm --filter ./mastracode/tui run e2e:smoke.
For focused scenario development, use MC_E2E_VITEST_SCENARIOS=<scenario> pnpm --filter ./mastracode/tui exec vitest run --config e2e/vitest.config.ts --reporter=dot.
Run pnpm --filter ./mastracode/tui run e2e:test -- --reporter=dot before shipping runner changes.

For Mastra Code TUI work, use the testing-mastracode-tui skill for interactive/manual testing guidance, but prefer mastracode/tui/e2e/README.md as the source of truth for runner commands.

TUI-visible or TUI-triggered behavior should have checked-in TUI e2e coverage; lower-level tests are supporting shields, not substitutes.
If realistic long conversation or OM fixture data is needed, read the local Mastra Code Application Support database only via read-only operations, sanitize it, and transform it into deterministic AIMock-compatible fixtures.

Keep changes here surgical; Mastra Code exercises core harness, storage, memory, tools, MCP, browser, plugins, signals, and TUI integration paths.
