Build from root: pnpm build:mastracode
Test from root: pnpm test:mastracode
Typecheck from root: pnpm --filter ./mastracode check

Workspace deps (@mastra/duckdb, @mastra/github-signals, @mastra/slack-signals, etc.) must have dist/ built before vitest can import them; pnpm build:mastracode from root handles this
Running vitest directly after a fresh checkout will fail with "Failed to resolve entry for package @mastra/..." until those are built

This package has both unit and E2E coverage
Unit tests run first (fast, serial): pnpm --filter ./mastracode exec vitest run --reporter=dot --bail 1
Narrowest: target specific files, e.g. pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts
E2E (slow, terminal backend): pnpm --filter ./mastracode e2e:test or e2e:smoke for a subset

Signal providers are wired in src/index.ts and gated by globalSettings.signals flags
Test mocks for signal packages live in src/__tests__/vitest-setup.ts — add new signal packages there so tests don't require built dist/
Settings changes: update SignalSettings interface, DEFAULTS.signals, parseSignalSettings(), signalSettingsEqual(), and both test mock factories (createMockSettings() in index.test.ts and settings.test.ts)

Keep changes here surgical; mastracode is the top-level harness many users depend on