/**
 * /profile command — manage the built-in memory profiler.
 *
 * Subcommands:
 *   /profile              — show status (alias for /profile status)
 *   /profile status       — show current profiler state and output location
 *   /profile start        — start sampling (with optional threshold overrides)
 *   /profile stop         — stop sampling
 *   /profile snapshot     — manually trigger a V8 heap snapshot
 */
import { MemoryProfiler } from '../../utils/memory-profiler.js';
import { theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

function getProfiler(ctx: SlashCommandContext): MemoryProfiler | undefined {
  return ctx.state.memoryProfiler;
}

function showStatus(ctx: SlashCommandContext, profiler: MemoryProfiler): void {
  const s = profiler.status();
  const lines: string[] = [theme.bold(theme.fg('accent', 'Memory Profiler')), ''];

  lines.push(theme.bold('State'));
  if (s.running) {
    lines.push(`  ${theme.fg('success', '●')} Running`);
  } else {
    lines.push(`  ${theme.fg('dim', '●')} Stopped`);
  }

  lines.push(`  Interval:      ${s.intervalMs}ms`);
  lines.push(`  Samples:       ${s.sampleCount}`);
  lines.push(`  Snapshots:     ${s.snapshotCount}${s.maxSnapshots > 0 ? ` / ${s.maxSnapshots} (max auto)` : ' (manual only)'}`);

  if (s.heapThresholdBytes) {
    lines.push(`  Heap trigger:  ${(s.heapThresholdBytes / 1024 / 1024).toFixed(0)} MB`);
  } else {
    lines.push(`  Heap trigger:  ${theme.fg('dim', '—')}`);
  }
  if (s.rssThresholdBytes) {
    lines.push(`  RSS trigger:   ${(s.rssThresholdBytes / 1024 / 1024).toFixed(0)} MB`);
  } else {
    lines.push(`  RSS trigger:   ${theme.fg('dim', '—')}`);
  }

  lines.push('');
  lines.push(theme.bold('Output'));
  lines.push(`  Directory:     ${s.outDir}`);
  if (s.sampleCount > 0) {
    lines.push(`  Samples file:  ${s.outDir}/samples.jsonl`);
  }

  if (s.sampleCount > 0 && s.latestSample) {
    lines.push('');
    lines.push(theme.bold('Latest Sample'));
    lines.push(`  heapUsed:      ${(s.latestSample.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`  heapTotal:     ${(s.latestSample.heapTotal / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`  rss:           ${(s.latestSample.rss / 1024 / 1024).toFixed(1)} MB`);
    if (s.latestSample.mode) lines.push(`  mode:          ${s.latestSample.mode}`);
    if (s.latestSample.modelId) lines.push(`  model:         ${s.latestSample.modelId}`);
    if (s.latestSample.threadId) lines.push(`  thread:        ${s.latestSample.threadId}`);
  }

  lines.push('');
  lines.push(theme.fg('dim', 'Commands:'));
  lines.push(theme.fg('dim', '  /profile status       — show profiler status'));
  lines.push(theme.fg('dim', '  /profile start        — start sampling'));
  lines.push(theme.fg('dim', '  /profile stop         — stop sampling'));
  lines.push(theme.fg('dim', '  /profile snapshot     — write heap snapshot now'));

  ctx.showInfo(lines.join('\n'));
}

function handleStart(ctx: SlashCommandContext, args: string[]): void {
  const existing = getProfiler(ctx);
  if (existing) {
    const s = existing.status();
    if (s.running) {
      ctx.showInfo('Memory profiler is already running.');
      return;
    }
    // Reuse the existing profiler instance
    existing.start();
    ctx.showInfo('Memory profiler started.');
    return;
  }

  // Parse optional args
  let heapThresholdBytes: number | undefined;
  let rssThresholdBytes: number | undefined;
  let intervalMs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--heap-mb' && i + 1 < args.length) {
      heapThresholdBytes = parseFloat(args[++i]!) * 1024 * 1024;
    } else if (args[i] === '--rss-mb' && i + 1 < args.length) {
      rssThresholdBytes = parseFloat(args[++i]!) * 1024 * 1024;
    } else if (args[i] === '--interval-ms' && i + 1 < args.length) {
      intervalMs = parseInt(args[++i]!, 10);
    }
  }

  const profiler = new MemoryProfiler({
    intervalMs,
    heapThresholdBytes,
    rssThresholdBytes,
    getMode: () => ctx.harness.getCurrentModeId() ?? undefined,
    getThreadId: () => ctx.harness.getCurrentThreadId() ?? undefined,
    getResourceId: () => ctx.harness.getResourceId(),
    getModelId: () => ctx.harness.getCurrentModelId() ?? undefined,
  });

  // Store it on state for subsequent commands
  ctx.state.memoryProfiler = profiler;
  profiler.start();

  ctx.showInfo(
    `Memory profiler started.\n  Writing samples to: ${profiler.outDir}` +
      (heapThresholdBytes ? `\n  Heap threshold:  ${(heapThresholdBytes / 1024 / 1024).toFixed(0)} MB` : '') +
      (rssThresholdBytes ? `\n  RSS threshold:   ${(rssThresholdBytes / 1024 / 1024).toFixed(0)} MB` : '') +
      `\n  Interval:        ${profiler.intervalMs}ms`,
  );
}

function handleStop(ctx: SlashCommandContext): void {
  const profiler = getProfiler(ctx);
  if (!profiler) {
    ctx.showInfo('No memory profiler is configured. Use /profile start to create one.');
    return;
  }
  const s = profiler.status();
  if (!s.running) {
    ctx.showInfo('Memory profiler is already stopped.');
    return;
  }
  profiler.stop();
  ctx.showInfo(
    `Memory profiler stopped.\n  Samples collected: ${s.sampleCount}\n  Snapshots taken:  ${s.snapshotCount}\n  Location:         ${s.outDir}`,
  );
}

function handleSnapshot(ctx: SlashCommandContext): void {
  const profiler = getProfiler(ctx);
  if (!profiler) {
    // Allow snapshot without a running profiler
    ctx.showInfo(
      `${theme.fg('warning', '⚠')} No profiler configured. Writing a one-off snapshot...`,
    );
    const tmpProfiler = new MemoryProfiler();
    const path = tmpProfiler.snapshot('manual');
    if (path) {
      ctx.showInfo(`Heap snapshot written to:\n  ${path}`);
    } else {
      ctx.showError('Failed to write heap snapshot.');
    }
    return;
  }

  const path = profiler.snapshot('manual');
  if (path) {
    ctx.showInfo(`Heap snapshot written to:\n  ${path}`);
  } else {
    ctx.showError('Failed to write heap snapshot.');
  }
}

export async function handleProfileCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const subcommand = args[0]?.toLowerCase();

  // /profile or /profile status
  if (!subcommand || subcommand === 'status') {
    const profiler = getProfiler(ctx);
    if (profiler) {
      showStatus(ctx, profiler);
    } else {
      ctx.showInfo(
        `${theme.fg('dim', 'No memory profiler configured.')}\n\n` +
          `Set MASTRACODE_PROFILE=1 to auto-profile from startup, or use:\n` +
          `  /profile start             — start profiling\n` +
          `  /profile start --heap-mb 200 — profile with 200 MB heap threshold\n` +
          `  /profile start --rss-mb 500  — profile with 500 MB RSS threshold\n` +
          `  /profile snapshot            — one-off heap snapshot\n` +
          `  /profile stop                — stop profiling`,
      );
    }
    return;
  }

  switch (subcommand) {
    case 'start':
      handleStart(ctx, args.slice(1));
      break;
    case 'stop':
      handleStop(ctx);
      break;
    case 'snapshot':
      handleSnapshot(ctx);
      break;
    default:
      ctx.showError(`Unknown subcommand: ${subcommand}. Try /profile status.`);
  }
}
