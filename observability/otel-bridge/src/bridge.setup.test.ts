/**
 * Full-setup tests for OtelBridge: a real Mastra instance and agent run, with
 * the OTEL tracer provider wired up (or not) the way users do it.
 *
 * Regression tests for https://github.com/mastra-ai/mastra/issues/24950
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { Observability, TestExporter } from '@mastra/observability';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { tracing } from '@opentelemetry/sdk-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OtelBridge } from './bridge.js';

const SETUP_DOCS_URL = 'https://mastra.ai/reference/observability/tracing/bridges/otel#setup-requirements';

function createModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      content: [{ type: 'text', text: 'ok' }],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
}

function createInMemoryProvider() {
  const exporter = new tracing.InMemorySpanExporter();
  const provider = new tracing.BasicTracerProvider({
    spanProcessors: [new tracing.SimpleSpanProcessor(exporter)],
  });
  return { exporter, provider };
}

function setup(bridge: OtelBridge) {
  const logger = new ConsoleLogger({ name: 'otel-bridge-setup-test', level: 'debug' });
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'debug').mockImplementation(() => {});
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  const mastraSpans = new TestExporter();

  const mastra = new Mastra({
    logger,
    agents: {
      agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Reply ok.', model: createModel() }),
    },
    observability: new Observability({
      configs: {
        default: { serviceName: 'otel-bridge-setup-test', bridge, exporters: [mastraSpans] },
      },
    }),
  });

  const bridgeWarnings = () =>
    warn.mock.calls.map(call => String(call[0])).filter(message => message.startsWith('[OtelBridge]'));

  const run = async () => {
    const result = await mastra.getAgent('agent').generate('hi');
    expect(result.text).toBe('ok');
    await mastra.observability.getDefaultInstance()?.flush();
  };

  return { mastra, mastraSpans, bridgeWarnings, run };
}

describe('OtelBridge full setup', () => {
  beforeEach(() => {
    trace.disable();
    context.disable();
  });

  afterEach(() => {
    trace.disable();
    context.disable();
    vi.restoreAllMocks();
  });

  describe('when no tracer provider is registered or passed', () => {
    it('warns exactly once across multiple agent runs, with a link to the setup docs', async () => {
      const { bridgeWarnings, run, mastra } = setup(new OtelBridge());

      await run();
      await run();

      const warnings = bridgeWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('No OpenTelemetry tracer provider is registered globally');
      expect(warnings[0]).toContain(SETUP_DOCS_URL);

      await mastra.shutdown();
    });

    it('does not reuse an outer span ID from an unregistered provider', async () => {
      context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
      const outer = createInMemoryProvider();
      const outerTracer = outer.provider.getTracer('outer');

      const { bridgeWarnings, run, mastra, mastraSpans } = setup(new OtelBridge());

      const outerSpanId = await outerTracer.startActiveSpan('outer', async span => {
        await run();
        await run();
        span.end();
        return span.spanContext().spanId;
      });

      expect(bridgeWarnings()).toHaveLength(1);

      const spanIds = mastraSpans.getCompletedSpans().map(span => span.id);
      expect(spanIds.length).toBeGreaterThan(1);
      expect(new Set(spanIds).size).toBe(spanIds.length);
      expect(spanIds).not.toContain(outerSpanId);

      await mastra.shutdown();
      await outer.provider.shutdown();
    });
  });

  describe('when the bridge is configured correctly', () => {
    it('does not warn and exports spans when the provider is registered globally', async () => {
      const { exporter, provider } = createInMemoryProvider();
      trace.setGlobalTracerProvider(provider);

      const { bridgeWarnings, run, mastra } = setup(new OtelBridge());
      await run();
      await provider.forceFlush();

      expect(bridgeWarnings()).toEqual([]);
      expect(exporter.getFinishedSpans().length).toBeGreaterThan(0);

      await mastra.shutdown();
      await provider.shutdown();
    });

    it('does not warn and exports spans when the provider is passed as tracerProvider', async () => {
      const { exporter, provider } = createInMemoryProvider();

      const { bridgeWarnings, run, mastra } = setup(new OtelBridge({ tracerProvider: provider }));
      await run();
      await provider.forceFlush();

      expect(bridgeWarnings()).toEqual([]);
      expect(exporter.getFinishedSpans().length).toBeGreaterThan(0);

      await mastra.shutdown();
      await provider.shutdown();
    });
  });
});
