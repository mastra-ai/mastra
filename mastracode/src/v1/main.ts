#!/usr/bin/env node
/**
 * v1 entry point for MastraCode.
 *
 * Run via `pnpm cli:v1` from `mastracode/`. Lives alongside `src/main.ts`
 * (the legacy TUI entry) during the rebuild. The two entry points share
 * nothing on purpose — see `src/v1/AGENTS.md`.
 */
import { bootstrapV1 } from './bootstrap.js';
import { MastraTUIV1 } from './tui/index.js';

async function main(): Promise<void> {
  const { harness, project } = await bootstrapV1();
  const tui = new MastraTUIV1({ harness, projectRoot: project.rootPath });
  await tui.run();
}

main().catch(error => {
  const msg = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`v1 fatal: ${msg}\n`);
  process.exit(1);
});
