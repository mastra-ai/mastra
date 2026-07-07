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
 *   /prune          delete rows older than the retention policies, then exit
 *   /prune vacuum   prune, then checkpoint WAL + VACUUM to return disk to the OS, then exit
 */
import { runStorageMaintenance } from '../../utils/storage-maintenance.js';

import type { SlashCommandContext } from './types.js';

export async function handlePruneCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const maintenance = ctx.state.options.storageMaintenance;
  if (!maintenance) {
    ctx.showError('Storage maintenance is not available in this session.');
    return;
  }

  const sub = args[0]?.toLowerCase() ?? '';
  if (sub && sub !== 'vacuum') {
    ctx.showError(`Unknown /prune subcommand: ${sub}\nUsage: /prune [vacuum]`);
    return;
  }

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
    // Quiesce background writers so maintenance has the db to itself.
    await Promise.allSettled([
      ctx.mcpManager?.disconnect(),
      ctx.controller.getMastra()?.stopWorkers(),
      ctx.controller.stopIntervals(),
    ]);

    await runStorageMaintenance({ maintenance, vacuum: sub === 'vacuum', log });
    log('Storage maintenance complete. Run mastracode to start a new session.');
  } catch (err) {
    log(`Storage maintenance failed: ${err instanceof Error ? err.message : String(err)}`);
    exitCode = 1;
  }
  // The storage connection is closed — a fresh process is required either way.
  process.exit(exitCode);
}
