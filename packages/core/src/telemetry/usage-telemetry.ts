import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Mastra } from '../mastra';
import type { GetMetricBreakdownResponse, ObservabilityStorage } from '../storage/domains';
import { getServerTelemetryContext } from './context';
import { captureTelemetryEvent, isTelemetryEnabled } from './posthog';

const INPUT_TOKENS_METRIC = 'mastra_model_total_input_tokens';
const OUTPUT_TOKENS_METRIC = 'mastra_model_total_output_tokens';
const BREAKDOWN_LIMIT = 200;

export const USAGE_TELEMETRY_EVENT = 'mastra_model_token_usage';

export interface SyncUsageTelemetryOptions {
  /** Override the cursor file location (used by tests). */
  cursorPath?: string;
  /** Override the current time (used by tests). */
  now?: Date;
}

interface UsageTelemetryCursors {
  projects: Record<string, string>;
}

interface UsageRow {
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

function getDefaultCursorPath(): string {
  return path.join(os.homedir(), '.mastra', 'usage-telemetry.json');
}

function readCursors(cursorPath: string): UsageTelemetryCursors {
  try {
    const parsed = JSON.parse(readFileSync(cursorPath, 'utf-8')) as Partial<UsageTelemetryCursors> | null;
    if (parsed && typeof parsed === 'object' && parsed.projects && typeof parsed.projects === 'object') {
      return { projects: parsed.projects };
    }
  } catch {
    // Missing or corrupt cursor file - treat as first sync.
  }
  return { projects: {} };
}

function readCursor(cursorPath: string, projectId: string): Date | undefined {
  const value = readCursors(cursorPath).projects[projectId];
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function writeCursor(cursorPath: string, projectId: string, syncedAt: Date): void {
  const cursors = readCursors(cursorPath);
  cursors.projects[projectId] = syncedAt.toISOString();
  mkdirSync(path.dirname(cursorPath), { recursive: true });
  writeFileSync(cursorPath, JSON.stringify(cursors));
}

function applyBreakdown(
  rows: Map<string, UsageRow>,
  response: GetMetricBreakdownResponse,
  field: keyof Pick<UsageRow, 'inputTokens' | 'outputTokens' | 'totalInputTokens' | 'totalOutputTokens'>,
): void {
  for (const group of response.groups) {
    const provider = group.dimensions.provider ?? null;
    const model = group.dimensions.model ?? null;
    const key = `${provider}\u0000${model}`;
    let row = rows.get(key);
    if (!row) {
      row = { provider, model, inputTokens: 0, outputTokens: 0, totalInputTokens: 0, totalOutputTokens: 0 };
      rows.set(key, row);
    }
    row[field] += group.value ?? 0;
  }
}

/**
 * Sends aggregated model token usage (input/output tokens per provider+model) to
 * Mastra's anonymous telemetry when the project has observability metrics enabled.
 *
 * Sync strategy: deltas since the last successful sync, tracked per project via a
 * cursor file in `~/.mastra/usage-telemetry.json`. Each event also carries lifetime
 * totals so consumers can read either incremental or cumulative usage. Runs once at
 * server startup; respects `MASTRA_TELEMETRY_DISABLED`. Never throws.
 */
export async function syncUsageTelemetry(mastra: Mastra, options: SyncUsageTelemetryOptions = {}): Promise<void> {
  try {
    if (!isTelemetryEnabled()) {
      return;
    }

    const observability = mastra.getStorage()?.stores?.observability as ObservabilityStorage | undefined;
    if (!observability || typeof observability.getMetricBreakdown !== 'function') {
      return;
    }

    const { projectId, distinctId, command, nodeEnv } = getServerTelemetryContext();
    const cursorPath = options.cursorPath ?? getDefaultCursorPath();
    const lastSyncedAt = readCursor(cursorPath, projectId);
    const now = options.now ?? new Date();
    if (lastSyncedAt && lastSyncedAt.getTime() >= now.getTime()) {
      return;
    }

    const baseArgs = {
      groupBy: ['provider', 'model'],
      aggregation: 'sum' as const,
      limit: BREAKDOWN_LIMIT,
    };
    const deltaFilters = {
      timestamp: { ...(lastSyncedAt ? { start: lastSyncedAt, startExclusive: true } : {}), end: now },
    };
    const totalFilters = { timestamp: { end: now } };

    const [inputDelta, outputDelta, inputTotal, outputTotal] = await Promise.all([
      observability.getMetricBreakdown({ ...baseArgs, name: [INPUT_TOKENS_METRIC], filters: deltaFilters }),
      observability.getMetricBreakdown({ ...baseArgs, name: [OUTPUT_TOKENS_METRIC], filters: deltaFilters }),
      observability.getMetricBreakdown({ ...baseArgs, name: [INPUT_TOKENS_METRIC], filters: totalFilters }),
      observability.getMetricBreakdown({ ...baseArgs, name: [OUTPUT_TOKENS_METRIC], filters: totalFilters }),
    ]);

    const rows = new Map<string, UsageRow>();
    applyBreakdown(rows, inputDelta, 'inputTokens');
    applyBreakdown(rows, outputDelta, 'outputTokens');
    applyBreakdown(rows, inputTotal, 'totalInputTokens');
    applyBreakdown(rows, outputTotal, 'totalOutputTokens');

    const isFirstSync = !lastSyncedAt;

    for (const row of rows.values()) {
      if (row.inputTokens <= 0 && row.outputTokens <= 0) {
        continue;
      }
      captureTelemetryEvent(USAGE_TELEMETRY_EVENT, distinctId, {
        provider: row.provider,
        model: row.model,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        total_input_tokens: row.totalInputTokens,
        total_output_tokens: row.totalOutputTokens,
        command,
        node_env: nodeEnv,
        project_id: projectId,
        is_first_sync: isFirstSync,
        window_start: lastSyncedAt?.toISOString() ?? null,
        window_end: now.toISOString(),
      });
    }

    writeCursor(cursorPath, projectId, now);
  } catch {
    // Usage telemetry must never affect server startup or runtime behavior.
  }
}
