/**
 * /prune — hand the terminal over to storage maintenance.
 *
 * Retention deletes and VACUUM need the database to themselves: running them
 * over the live connection contends with agent writes (SQLITE_BUSY) and
 * starves the TUI event loop, freezing the UI. So this command stops the TUI,
 * quiesces background writers, runs maintenance with plain-text progress
 * output on the released terminal, then exits the process.
 *
 * Usage:
 *   /prune                      delete rows older than the retention policies, then exit
 *   /prune vacuum               prune, then checkpoint WAL + VACUUM to return disk to the OS, then exit
 *   /prune keep-memory          prune, but keep chat history (messages/threads)
 *   /prune vacuum keep-memory   flags combine in any order
 */
import { runStorageMaintenance } from '@mastra/code-sdk/utils/storage-maintenance';

import type { SlashCommandContext } from './types.js';

export async function handlePruneCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const maintenance = ctx.state.options.storageMaintenance;
  if (!maintenance) {
    ctx.showError('Storage maintenance is not available in this session.');
    return;
  }

  const flags = new Set(args.map(a => a.toLowerCase()));
  const unknown = [...flags].filter(f => f !== 'vacuum' && f !== 'keep-memory');
  if (unknown.length > 0) {
    ctx.showError(`Unknown /prune option: ${unknown.join(', ')}\nUsage: /prune [vacuum] [keep-memory]`);
    return;
  }
  const vacuum = flags.has('vacuum');
  const keepMemory = flags.has('keep-memory');

  // Hand the terminal back so progress prints as plain text and the deletes
  // can't freeze the UI or race the agent's own writes. The TUI's alternate
  // screen is discarded on stop, so all messaging goes to console.log after.
  ctx.stop();

  // console.info goes to the released terminal (and is captured by the e2e
  // terminal backend).
  const log = (line: string) => console.info(line);
  log('Closing the TUI to run storage maintenance…');
  let exitCode = 0;
  try {
    // Quiesce background writers so maintenance has the db to itself. Surface
    // any failures — a writer that didn't stop is exactly the SQLITE_BUSY
    // contention this handoff exists to prevent.
    const quiesceSteps = ['MCP disconnect', 'stop workers', 'stop intervals'] as const;
    const quiesceResults = await Promise.allSettled([
      ctx.mcpManager?.disconnect(),
      ctx.controller.getMastra()?.stopWorkers(),
      ctx.controller.stopIntervals(),
    ]);
    for (const [i, result] of quiesceResults.entries()) {
      if (result.status === 'rejected') {
        log(
          `Warning: failed to quiesce a background writer (${quiesceSteps[i]}): ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`,
        );
      }
    }

    await runStorageMaintenance({ maintenance, vacuum, keepMemory, log });
    log('Storage maintenance complete. Run mastracode to start a new session.');
  } catch (err) {
    log(`Storage maintenance failed: ${err instanceof Error ? err.message : String(err)}`);
    exitCode = 1;
  }
  // The storage connection is closed — a fresh process is required either way.
  process.exit(exitCode);
}
