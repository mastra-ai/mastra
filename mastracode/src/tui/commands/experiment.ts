/**
 * /experiment command — manage and run experiments from the TUI.
 *
 * Usage:
 *   /experiment seed [--limit N] [--feedback-only]  — Seed dataset from DuckDB traces
 *   /experiment run [--dataset ID] [--concurrency N] — Run experiment against dataset
 *   /experiment results [--last N]                  — Show recent experiment results
 */

import type { ObservabilityStorage } from '@mastra/core/storage';
import type { ObservabilityStoreLike } from '../../evals/experiments/seed-dataset.js';
import type { SlashCommandContext } from './types.js';

export async function handleExperimentCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === 'help') {
    ctx.showInfo(`Usage:
  /experiment seed [--limit N] [--feedback-only]  — Seed dataset from traces
  /experiment run [--dataset ID] [--concurrency N] — Run experiment
  /experiment results [--last N]                  — Show results`);
    return;
  }

  switch (subcommand) {
    case 'seed':
      await handleSeed(ctx, args.slice(1));
      break;
    case 'run':
      await handleRun(ctx, args.slice(1));
      break;
    case 'results':
      await handleResults(ctx, args.slice(1));
      break;
    default:
      ctx.showError(`Unknown subcommand: ${subcommand}. Use /experiment help.`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /experiment seed
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleSeed(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const mastra = ctx.harness.getMastra();
  if (!mastra) {
    ctx.showError('Mastra instance not available.');
    return;
  }

  const storage = mastra.getStorage();
  if (!storage) {
    ctx.showError('Storage not configured.');
    return;
  }

  let observabilityStore: ObservabilityStorage | undefined;
  try {
    observabilityStore = await storage.getStore('observability');
  } catch {
    // May throw if domain not available
  }
  if (!observabilityStore) {
    ctx.showError('Observability storage not available — no traces to seed from.');
    return;
  }

  // Parse options
  const limit = parseIntArg(args, '--limit') ?? 20;
  const feedbackOnly = args.includes('--feedback-only');

  ctx.showInfo(`Seeding experiment dataset from traces (limit: ${limit}, feedback-only: ${feedbackOnly})...`);

  try {
    const { seedFromTraces } = await import('../../evals/experiments/seed-dataset.js');

    const result = await seedFromTraces(observabilityStore as ObservabilityStoreLike, {
      limit,
      ...(feedbackOnly ? { withFeedbackOnly: true } : {}),
    });

    ctx.showInfo(
      `Seeded ${result.itemsCreated} items (${result.itemsSkipped} skipped).`,
    );
  } catch (error) {
    ctx.showError(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /experiment run
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleRun(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const mastra = ctx.harness.getMastra();
  if (!mastra) {
    ctx.showError('Mastra instance not available.');
    return;
  }

  const datasetId = parseStringArg(args, '--dataset') ?? 'mastracode-experiment';
  const concurrency = parseIntArg(args, '--concurrency') ?? 2;

  ctx.showInfo(`Running experiment on dataset "${datasetId}" (concurrency: ${concurrency})...`);

  try {
    const { runSandboxExperiment } = await import('@mastra/core/datasets');
    const { createMastraCodeLifecycle } = await import('../../evals/experiments/lifecycle.js');
    const { createOutcomeMatchScorer } = await import('../../evals/scorers/offline/outcome-match.js');
    const { createTrajectoryEfficiencyScorer } = await import(
      '../../evals/scorers/offline/trajectory-efficiency.js'
    );

    const lifecycle = createMastraCodeLifecycle();
    const scorers = [createOutcomeMatchScorer(), createTrajectoryEfficiencyScorer()];

    const results = await runSandboxExperiment(mastra, {
      datasetId,
      lifecycle,
      scorers,
      maxConcurrency: concurrency,
      name: `cli-experiment-${Date.now()}`,
    });

    const avgScores = results.results.map(r => {
      if (!r.scores || r.scores.length === 0) return 0;
      const valid = r.scores.filter(s => s.score !== null);
      return valid.length > 0 ? valid.reduce((sum, s) => sum + (s.score ?? 0), 0) / valid.length : 0;
    });
    const overallAvg = avgScores.length > 0
      ? (avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(3)
      : 'N/A';

    ctx.showInfo(
      `Experiment complete: ${results.results.length} items scored.\n` +
        `Succeeded: ${results.succeededCount}, Failed: ${results.failedCount}\n` +
        `Average score: ${overallAvg}`,
    );
  } catch (error) {
    ctx.showError(`Experiment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /experiment results
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleResults(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const mastra = ctx.harness.getMastra();
  if (!mastra) {
    ctx.showError('Mastra instance not available.');
    return;
  }

  const storage = mastra.getStorage();
  if (!storage) {
    ctx.showError('Storage not configured.');
    return;
  }

  let observabilityStore: ObservabilityStorage | undefined;
  try {
    observabilityStore = await storage.getStore('observability');
  } catch {
    // May throw if domain not available
  }
  if (!observabilityStore) {
    ctx.showError('Observability storage not available.');
    return;
  }

  const last = parseIntArg(args, '--last') ?? 5;

  try {
    // Query recent score events for experiment results
    const listScores = (observabilityStore as unknown as Record<string, unknown>).listScores as
      | ((args: Record<string, unknown>) => Promise<{ scores: Array<{ scorerId?: string; scorerName?: string | null; score: number; timestamp?: Date | string | null }> }>)
      | undefined;
    if (!listScores) {
      ctx.showError('Observability store does not support listScores.');
      return;
    }
    const response = await listScores({
      filters: { scoreSource: 'experiment' },
      orderBy: { field: 'timestamp', direction: 'DESC' },
      pagination: { page: 0, perPage: last },
    });

    const scores = response?.scores;
    if (!scores || scores.length === 0) {
      ctx.showInfo('No experiment results found.');
      return;
    }

    const lines: string[] = [`Last ${Math.min(last, scores.length)} experiment scores:`];
    for (const s of scores) {
      const name = s.scorerName ?? s.scorerId ?? 'unknown';
      const scoreVal = typeof s.score === 'number' ? s.score.toFixed(3) : String(s.score);
      const date = s.timestamp ? new Date(s.timestamp as string | number | Date).toLocaleString() : 'unknown';
      lines.push(`  ${name}: ${scoreVal} (${date})`);
    }
    ctx.showInfo(lines.join('\n'));
  } catch (error) {
    ctx.showError(`Failed to fetch results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Arg parsing helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseIntArg(args: string[], flag: string): number | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  const val = parseInt(args[idx + 1]!, 10);
  return isNaN(val) ? undefined : val;
}

function parseStringArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}
