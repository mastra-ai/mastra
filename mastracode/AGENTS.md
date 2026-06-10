Build from root: pnpm run build:mastracode
Test from root: pnpm test:mastracode
Typecheck from root: pnpm --filter ./mastracode check
Lint from root: pnpm --filter ./mastracode lint

Run pnpm run build:mastracode before broad Mastra Code test audits so workspace dependency dist artifacts are available.
For focused tests, prefer pnpm --filter ./mastracode test -- --run <test-file> before the full package suite.

Most tests live under mastracode/src/ and are colocated with the code they cover.
Run focused agent, model, headless, TUI, command, or MCP tests before broader validation when those areas change.

For Mastra Code TUI/e2e scenario tests, use the `testing-mastracode-tui` skill. Add scenarios under `mastracode/scripts/mc-e2e/scenarios/`, keep them checked in, use AIMock fixtures for LLM calls, and verify with `pnpm --filter ./mastracode run e2e:test <scenario>`.

For test-recovery work, TUI-visible or TUI-triggered behavior requires checked-in TUI e2e coverage before a tracker row can be marked validated; lower-level tests are supporting shields, not substitutes. If realistic long conversation or OM fixture data is needed, read the local Mastra Code Application Support database only via read-only operations, sanitize it, and transform it into deterministic AIMock-compatible fixtures.

Keep changes here surgical; Mastra Code exercises core harness, storage, memory, tools, MCP, browser, and TUI integration paths.
