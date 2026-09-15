import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, flush, PostHog } = vi.hoisted(() => {
  const capture = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);
  const PostHog = vi.fn(function () {
    return { capture, flush };
  });
  return { capture, flush, PostHog };
});

vi.mock('posthog-node', () => ({ PostHog }));

import type { Mastra } from '../mastra';
import type { CreateMetricRecord } from '../storage/domains';
import { InMemoryStore } from '../storage/mock';
import { resetEETelemetryForTests } from './posthog';
import { syncUsageTelemetry, USAGE_TELEMETRY_EVENT } from './usage-telemetry';

const INPUT_METRIC = 'mastra_model_total_input_tokens';
const OUTPUT_METRIC = 'mastra_model_total_output_tokens';

function makeMetric(overrides: Partial<CreateMetricRecord> & Pick<CreateMetricRecord, 'name' | 'value'>) {
  return {
    metricId: overrides.metricId ?? `metric-${Math.random().toString(36).slice(2)}`,
    timestamp: overrides.timestamp ?? new Date('2026-06-01T00:00:00Z'),
    provider: 'openai',
    model: 'gpt-test',
    labels: {},
    ...overrides,
  } as CreateMetricRecord;
}

function makeMastra(store: InMemoryStore | undefined): Mastra {
  return { getStorage: () => store } as unknown as Mastra;
}

describe('syncUsageTelemetry', () => {
  let tmpDir: string;
  let cursorPath: string;
  let store: InMemoryStore;
  let originalTelemetryDisabled: string | undefined;

  beforeEach(() => {
    originalTelemetryDisabled = process.env['MASTRA_TELEMETRY_DISABLED'];
    delete process.env['MASTRA_TELEMETRY_DISABLED'];
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mastra-usage-telemetry-'));
    cursorPath = path.join(tmpDir, 'cursors', 'usage-telemetry.json');
    store = new InMemoryStore();
    capture.mockClear();
    flush.mockClear();
    PostHog.mockClear();
    resetEETelemetryForTests();
  });

  afterEach(() => {
    if (originalTelemetryDisabled !== undefined) process.env['MASTRA_TELEMETRY_DISABLED'] = originalTelemetryDisabled;
    else delete process.env['MASTRA_TELEMETRY_DISABLED'];
    rmSync(tmpDir, { recursive: true, force: true });
    resetEETelemetryForTests();
  });

  async function seedUsage() {
    const observability = store.stores.observability!;
    await observability.batchCreateMetrics({
      metrics: [
        makeMetric({ name: INPUT_METRIC, value: 100, timestamp: new Date('2026-06-01T00:00:00Z') }),
        makeMetric({ name: INPUT_METRIC, value: 50, timestamp: new Date('2026-06-02T00:00:00Z') }),
        makeMetric({ name: OUTPUT_METRIC, value: 30, timestamp: new Date('2026-06-02T00:00:00Z') }),
        makeMetric({
          name: INPUT_METRIC,
          value: 7,
          timestamp: new Date('2026-06-02T00:00:00Z'),
          provider: 'anthropic',
          model: 'claude-test',
        }),
      ],
    });
  }

  it('sends one event per provider/model with delta and lifetime totals on first sync', async () => {
    await seedUsage();

    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') });

    expect(capture).toHaveBeenCalledTimes(2);
    const events = capture.mock.calls.map(([arg]) => arg);
    expect(events.every(e => e.event === USAGE_TELEMETRY_EVENT)).toBe(true);

    const openai = events.find(e => e.properties.provider === 'openai');
    expect(openai!.properties).toMatchObject({
      model: 'gpt-test',
      input_tokens: 150,
      output_tokens: 30,
      total_input_tokens: 150,
      total_output_tokens: 30,
      is_first_sync: true,
      window_start: null,
      window_end: '2026-06-03T00:00:00.000Z',
    });

    const anthropic = events.find(e => e.properties.provider === 'anthropic');
    expect(anthropic!.properties).toMatchObject({
      model: 'claude-test',
      input_tokens: 7,
      output_tokens: 0,
      is_first_sync: true,
    });

    // Cursor file written with the sync timestamp.
    const cursors = JSON.parse(readFileSync(cursorPath, 'utf-8'));
    expect(Object.values(cursors.projects)).toEqual(['2026-06-03T00:00:00.000Z']);
  });

  it('only sends usage recorded after the last sync, with cumulative totals', async () => {
    await seedUsage();
    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') });
    capture.mockClear();

    // New usage after the first sync, only for openai.
    await store.stores.observability!.batchCreateMetrics({
      metrics: [makeMetric({ name: INPUT_METRIC, value: 25, timestamp: new Date('2026-06-04T00:00:00Z') })],
    });

    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-05T00:00:00Z') });

    // anthropic row had no new usage and is skipped.
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].properties).toMatchObject({
      provider: 'openai',
      model: 'gpt-test',
      input_tokens: 25,
      output_tokens: 0,
      total_input_tokens: 175,
      total_output_tokens: 30,
      is_first_sync: false,
      window_start: '2026-06-03T00:00:00.000Z',
      window_end: '2026-06-05T00:00:00.000Z',
    });
  });

  it('sends nothing when there is no usage', async () => {
    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') });

    expect(capture).not.toHaveBeenCalled();
    // Cursor still advances so the next sync stays incremental.
    expect(JSON.parse(readFileSync(cursorPath, 'utf-8')).projects).not.toEqual({});
  });

  it('does nothing when telemetry is disabled', async () => {
    process.env['MASTRA_TELEMETRY_DISABLED'] = 'true';
    await seedUsage();

    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') });

    expect(PostHog).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(() => readFileSync(cursorPath, 'utf-8')).toThrow();
  });

  it('does nothing when no storage is configured', async () => {
    await expect(
      syncUsageTelemetry(makeMastra(undefined), { cursorPath, now: new Date('2026-06-03T00:00:00Z') }),
    ).resolves.toBeUndefined();

    expect(capture).not.toHaveBeenCalled();
  });

  it('never throws when the storage query fails', async () => {
    const observability = store.stores.observability!;
    vi.spyOn(observability, 'getMetricBreakdown').mockRejectedValue(new Error('storage offline'));

    await expect(
      syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') }),
    ).resolves.toBeUndefined();

    expect(capture).not.toHaveBeenCalled();
    // Cursor must not advance on failure so usage is not lost.
    expect(() => readFileSync(cursorPath, 'utf-8')).toThrow();
  });

  it('tolerates a corrupt cursor file by treating the sync as first sync', async () => {
    await seedUsage();
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(path.dirname(cursorPath), { recursive: true });
    writeFileSync(cursorPath, 'not-json');

    await syncUsageTelemetry(makeMastra(store), { cursorPath, now: new Date('2026-06-03T00:00:00Z') });

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[0]![0].properties.is_first_sync).toBe(true);
  });
});
