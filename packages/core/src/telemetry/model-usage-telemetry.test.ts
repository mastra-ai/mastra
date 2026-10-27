import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, captureImmediate, PostHog } = vi.hoisted(() => {
  const capture = vi.fn();
  const captureImmediate = vi.fn().mockResolvedValue(undefined);
  const PostHog = vi.fn(function () {
    return { capture, captureImmediate };
  });
  return { capture, captureImmediate, PostHog };
});

const { execFile } = vi.hoisted(() => ({
  execFile: vi.fn((_file: string, _args: string[], _options: unknown, callback: (error: Error) => void) =>
    callback(new Error('git unavailable')),
  ),
}));

vi.mock('posthog-node', () => ({ PostHog }));
vi.mock('node:child_process', () => ({ execFile }));

import type { Mastra } from '../mastra';
import type { CostContext, ObservabilityExporter, ObservabilityInstance } from '../observability';
import {
  startModelUsageTelemetry,
  startServerlessModelUsageTelemetry,
  MODEL_USAGE_TELEMETRY_EVENT,
} from './model-usage-telemetry';
import { hashTelemetryValue, resetEETelemetryForTests } from './posthog';

const PLATFORM_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const PROJECT_ROOT = '/tmp/model-usage-telemetry-project';
const INTERVAL_MS = 60_000;

/** Minimal observability instance: exporters registered on it receive the metrics it emits. */
class FakeInstance {
  exporters: ObservabilityExporter[] = [];

  registerExporter(exporter: ObservabilityExporter) {
    if (!this.exporters.includes(exporter)) this.exporters.push(exporter);
  }

  emitMetric(name: string, value: number, costContext?: CostContext) {
    for (const exporter of this.exporters) {
      void exporter.onMetricEvent?.({
        type: 'metric',
        metric: { metricId: 'm', timestamp: new Date(), name, value, labels: {}, costContext },
      });
    }
  }

  emitTokens(input: number, output: number, provider = 'openai', model = 'gpt-4o-mini') {
    this.emitMetric('mastra_model_total_input_tokens', input, { provider, model });
    this.emitMetric('mastra_model_total_output_tokens', output, { provider, model });
  }

  async shutdown() {
    await Promise.all(this.exporters.map(exporter => exporter.shutdown()));
  }
}

function makeMastra(...instances: FakeInstance[]): Mastra {
  const entries = instances.map((instance, index) => [
    `instance-${index}`,
    instance as unknown as ObservabilityInstance,
  ]);
  return { observability: { listInstances: () => new Map(entries as [string, ObservabilityInstance][]) } } as Mastra;
}

function reportedEvents() {
  return captureImmediate.mock.calls.map(([message]) => message);
}

function reportedProperties() {
  return reportedEvents().map(event => event.properties);
}

describe('startModelUsageTelemetry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
    delete process.env['MASTRA_TELEMETRY_DISABLED'];
    delete process.env['MASTRA_CLI_DISTINCT_ID'];
    process.env['MASTRA_PROJECT_ROOT'] = PROJECT_ROOT;
    process.env['MASTRA_PROJECT_ID'] = PLATFORM_PROJECT_ID;
    capture.mockClear();
    captureImmediate.mockReset().mockResolvedValue(undefined);
    PostHog.mockClear();
    resetEETelemetryForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    resetEETelemetryForTests();
  });

  it('reports the tokens counted per provider and model when Mastra shuts down', async () => {
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance), { reportIntervalMs: INTERVAL_MS });

    instance.emitTokens(100, 20);
    instance.emitTokens(50, 10);
    instance.emitTokens(7, 3, 'anthropic', 'claude-sonnet-4-5');
    vi.setSystemTime(new Date('2026-10-14T00:05:00.000Z'));
    await instance.shutdown();

    expect(reportedEvents().map(event => event.event)).toEqual([
      MODEL_USAGE_TELEMETRY_EVENT,
      MODEL_USAGE_TELEMETRY_EVENT,
    ]);
    expect(reportedProperties()).toEqual([
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini',
        input_tokens: 150,
        output_tokens: 30,
        command: 'server',
        project_id: hashTelemetryValue(PROJECT_ROOT).slice(0, 16),
        project_id2: `mp_${PLATFORM_PROJECT_ID}`,
        window_start: '2026-10-14T00:00:00.000Z',
        window_end: '2026-10-14T00:05:00.000Z',
        report_reason: 'shutdown',
      }),
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        input_tokens: 7,
        output_tokens: 3,
      }),
    ]);
    expect(reportedProperties()[0]).not.toHaveProperty('runtime');
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports each interval only the usage since the previous report, in contiguous windows', async () => {
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance), { reportIntervalMs: INTERVAL_MS });

    instance.emitTokens(100, 20);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(reportedProperties()).toEqual([
      expect.objectContaining({ input_tokens: 100, output_tokens: 20, report_reason: 'interval' }),
    ]);

    // No usage in the second window, so nothing is sent.
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(captureImmediate).toHaveBeenCalledTimes(1);

    instance.emitTokens(40, 4);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await instance.shutdown();

    const [first, second] = reportedProperties();
    expect(captureImmediate).toHaveBeenCalledTimes(2);
    expect(second).toEqual(expect.objectContaining({ input_tokens: 40, output_tokens: 4, report_reason: 'interval' }));
    expect(second.window_start).toBe(first.window_end);
  });

  it('counts only input and output token metrics with positive values', async () => {
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance));

    instance.emitMetric('mastra_model_duration_ms', 900, { provider: 'openai', model: 'gpt-4o-mini' });
    instance.emitMetric('mastra_model_input_cache_read_tokens', 80, { provider: 'openai', model: 'gpt-4o-mini' });
    instance.emitMetric('mastra_model_total_input_tokens', 0, { provider: 'openai', model: 'gpt-4o-mini' });
    instance.emitMetric('mastra_model_total_input_tokens', Number.NaN, { provider: 'openai', model: 'gpt-4o-mini' });
    await instance.shutdown();
    expect(captureImmediate).not.toHaveBeenCalled();

    instance.emitMetric('mastra_model_total_output_tokens', 5);
    await instance.shutdown();
    expect(reportedProperties()).toEqual([
      expect.objectContaining({ provider: null, model: null, input_tokens: 0, output_tokens: 5 }),
    ]);
  });

  it('counts usage from every observability instance once and reports it once', async () => {
    const first = new FakeInstance();
    const second = new FakeInstance();
    startModelUsageTelemetry(makeMastra(first, second));

    first.emitTokens(100, 10);
    second.emitTokens(30, 3);
    await Promise.all([first.shutdown(), second.shutdown()]);

    expect(reportedProperties()).toEqual([expect.objectContaining({ input_tokens: 130, output_tokens: 13 })]);
  });

  it('does not meter the same Mastra instance twice', async () => {
    const instance = new FakeInstance();
    const mastra = makeMastra(instance);
    startModelUsageTelemetry(mastra);
    startModelUsageTelemetry(mastra);

    expect(instance.exporters).toHaveLength(1);
  });

  it('does nothing when telemetry is disabled', () => {
    process.env['MASTRA_TELEMETRY_DISABLED'] = '1';
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance));

    expect(instance.exporters).toHaveLength(0);
  });

  it('does nothing when observability is not configured', () => {
    expect(() => startModelUsageTelemetry(makeMastra())).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not report when observability is flushed', async () => {
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance));

    instance.emitTokens(100, 20);
    await instance.exporters[0]!.flush();
    await instance.shutdown();

    expect(reportedProperties()).toEqual([
      expect.objectContaining({ input_tokens: 100, output_tokens: 20, report_reason: 'shutdown' }),
    ]);
  });

  it('stops waiting for delivery at the shutdown timeout', async () => {
    captureImmediate.mockReturnValue(new Promise(() => {}));
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance), { shutdownTimeoutMs: 500 });

    instance.emitTokens(100, 20);
    let settled = false;
    const shutdown = instance.shutdown().then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await shutdown;
    expect(settled).toBe(true);
  });

  it('waits for an in-flight interval report before shutdown completes', async () => {
    let deliver!: () => void;
    captureImmediate.mockReturnValueOnce(new Promise<void>(resolve => (deliver = resolve)));
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance), { reportIntervalMs: INTERVAL_MS, shutdownTimeoutMs: 5_000 });

    instance.emitTokens(100, 20);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    let settled = false;
    const shutdown = instance.shutdown().then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBe(false);
    deliver();
    await shutdown;
    expect(settled).toBe(true);
  });

  it('never lets a delivery failure escape', async () => {
    captureImmediate.mockRejectedValue(new Error('posthog unavailable'));
    const instance = new FakeInstance();
    startModelUsageTelemetry(makeMastra(instance));

    instance.emitTokens(100, 20);
    await expect(instance.shutdown()).resolves.toBeUndefined();
    expect(captureImmediate).toHaveBeenCalledTimes(1);
  });
});

describe('startServerlessModelUsageTelemetry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
    delete process.env['MASTRA_TELEMETRY_DISABLED'];
    delete process.env['MASTRA_CLI_DISTINCT_ID'];
    delete process.env['MASTRA_PROJECT_ID'];
    process.env['MASTRA_PROJECT_ROOT'] = PROJECT_ROOT;
    captureImmediate.mockReset().mockResolvedValue(undefined);
    execFile.mockClear();
    resetEETelemetryForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    resetEETelemetryForTests();
  });

  it('reports the usage counted so far when asked, with the runtime and hashed project key', async () => {
    const instance = new FakeInstance();
    const reporter = startServerlessModelUsageTelemetry(makeMastra(instance), {
      runtime: 'vercel',
      projectKey: 'prj_abc123',
    });

    instance.emitTokens(100, 20);
    instance.emitTokens(7, 3, 'anthropic', 'claude-sonnet-4-5');
    vi.setSystemTime(new Date('2026-10-14T00:00:02.000Z'));
    await reporter!.report();

    expect(reportedProperties()).toEqual([
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini',
        input_tokens: 100,
        output_tokens: 20,
        command: 'server',
        project_id: hashTelemetryValue(PROJECT_ROOT).slice(0, 16),
        project_id2: hashTelemetryValue('prj_abc123').slice(0, 16),
        window_start: '2026-10-14T00:00:00.000Z',
        window_end: '2026-10-14T00:00:02.000Z',
        report_reason: 'request',
        runtime: 'vercel',
      }),
      expect.objectContaining({ provider: 'anthropic', input_tokens: 7, output_tokens: 3, runtime: 'vercel' }),
    ]);
    expect(JSON.stringify(reportedEvents())).not.toContain('prj_abc123');
    // Serverless servers have no Git checkout, so no lookup is attempted.
    expect(execFile).not.toHaveBeenCalled();
  });

  it('reports each token once across overlapping requests, in contiguous windows', async () => {
    const instance = new FakeInstance();
    const reporter = startServerlessModelUsageTelemetry(makeMastra(instance), { runtime: 'netlify' })!;

    instance.emitTokens(100, 20);
    const first = reporter.report();
    instance.emitTokens(40, 4);
    const second = reporter.report();
    // A request that used no model while another's usage was already reported sends nothing.
    const third = reporter.report();
    await Promise.all([first, second, third]);

    const [firstReport, secondReport] = reportedProperties();
    expect(reportedProperties()).toHaveLength(2);
    expect(firstReport).toEqual(expect.objectContaining({ input_tokens: 100, output_tokens: 20 }));
    expect(secondReport).toEqual(expect.objectContaining({ input_tokens: 40, output_tokens: 4 }));
    expect(secondReport.window_start).toBe(firstReport.window_end);
  });

  it('resolves report() only once the events are sent', async () => {
    let deliver!: () => void;
    captureImmediate.mockReturnValueOnce(new Promise<void>(resolve => (deliver = resolve)));
    const instance = new FakeInstance();
    const reporter = startServerlessModelUsageTelemetry(makeMastra(instance), { runtime: 'cloudflare' })!;

    instance.emitTokens(100, 20);
    let settled = false;
    const report = reporter.report().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBe(false);

    deliver();
    await report;
    expect(settled).toBe(true);
  });

  it('runs no timer and leaves project_id2 out without a project key', async () => {
    const instance = new FakeInstance();
    const reporter = startServerlessModelUsageTelemetry(makeMastra(instance), {
      runtime: 'cloudflare',
      projectKey: ' ',
    });

    expect(vi.getTimerCount()).toBe(0);
    instance.emitTokens(100, 20);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(captureImmediate).not.toHaveBeenCalled();

    await reporter!.report();
    expect(reportedProperties()[0]).not.toHaveProperty('project_id2');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('reports what is left when Mastra shuts down', async () => {
    const instance = new FakeInstance();
    startServerlessModelUsageTelemetry(makeMastra(instance), { runtime: 'vercel' });

    instance.emitTokens(100, 20);
    await instance.shutdown();

    expect(reportedProperties()).toEqual([
      expect.objectContaining({ input_tokens: 100, report_reason: 'shutdown', runtime: 'vercel' }),
    ]);
  });

  it('returns no reporter when telemetry is disabled, observability is missing, or usage is already counted', () => {
    const instance = new FakeInstance();
    const mastra = makeMastra(instance);
    expect(startServerlessModelUsageTelemetry(mastra, { runtime: 'vercel' })).toBeDefined();
    expect(startServerlessModelUsageTelemetry(mastra, { runtime: 'vercel' })).toBeUndefined();
    expect(instance.exporters).toHaveLength(1);

    expect(startServerlessModelUsageTelemetry(makeMastra(), { runtime: 'vercel' })).toBeUndefined();

    process.env['MASTRA_TELEMETRY_DISABLED'] = 'true';
    const disabled = new FakeInstance();
    expect(startServerlessModelUsageTelemetry(makeMastra(disabled), { runtime: 'vercel' })).toBeUndefined();
    expect(disabled.exporters).toHaveLength(0);
  });

  it('never lets a delivery failure escape report()', async () => {
    captureImmediate.mockRejectedValue(new Error('posthog unavailable'));
    const instance = new FakeInstance();
    const reporter = startServerlessModelUsageTelemetry(makeMastra(instance), { runtime: 'vercel' })!;

    instance.emitTokens(100, 20);
    await expect(reporter.report()).resolves.toBeUndefined();
  });
});
