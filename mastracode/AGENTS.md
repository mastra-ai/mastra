Build from root: pnpm build:mastracode
Test from root: pnpm test:mastracode
Typecheck from root: pnpm --filter ./mastracode check

For focused unit tests, run from mastracode with Vitest directly, e.g. `pnpm vitest run src/tui/__tests__/status-line.test.ts --bail 1 --reporter=dot`.
For E2E scenarios, prefer the narrowest scenario via `pnpm --filter ./mastracode e2e:smoke -- <scenario>` or the existing e2e runner pattern.

Most TUI tests live under mastracode/src/tui/ and mastracode/e2e/tui/.
Keep TUI changes focused and verify visible behavior with unit coverage plus narrow E2E when timing, terminal rendering, or input flow changes.
