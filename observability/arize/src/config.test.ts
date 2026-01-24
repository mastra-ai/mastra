import { SpanType } from '@mastra/core/observability';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createArizeConfig, type CreateArizeConfigOptions } from './config';

// Mock ArizeExporter
vi.mock('./tracing', () => ({
  ArizeExporter: vi.fn().mockImplementation(function (config: any) {
    this.config = config;
    return {
      config,
      exportTracingEvent: vi.fn(),
      shutdown: vi.fn(),
    };
  }),
}));

describe('createArizeConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    process.env = { ...originalEnv };
    delete process.env.PHOENIX_PROJECT_NAME;
    delete process.env.ARIZE_PROJECT_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates config with default serialization options', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.serializationOptions).toEqual({
      maxStringLength: 9999999,
      maxDepth: 9999999,
      maxArrayLength: 9999999,
      maxObjectKeys: 9999999,
    });
  });

  it('merges custom serialization options with defaults', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      serializationOptions: {
        maxStringLength: 1000,
        maxDepth: 5,
      },
    });

    expect(config.serializationOptions).toEqual({
      maxStringLength: 1000,
      maxDepth: 5,
      maxArrayLength: 9999999,
      maxObjectKeys: 9999999,
    });
  });

  it('allows overriding all serialization options', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      serializationOptions: {
        maxStringLength: 100,
        maxDepth: 5,
        maxArrayLength: 50,
        maxObjectKeys: 25,
      },
    });

    expect(config.serializationOptions).toEqual({
      maxStringLength: 100,
      maxDepth: 5,
      maxArrayLength: 50,
      maxObjectKeys: 25,
    });
  });

  it('includes default workflow loop filter in span processors', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.spanOutputProcessors).toHaveLength(1);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('workflow-loop-filter');
  });

  it('filters out workflow loop span types', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    const processor = config.spanOutputProcessors?.[0];
    expect(processor).toBeDefined();

    // Test that workflow loop types are filtered
    const workflowLoopSpan = { type: SpanType.WORKFLOW_LOOP } as any;
    expect(processor?.process(workflowLoopSpan)).toBeUndefined();

    const workflowParallelSpan = { type: SpanType.WORKFLOW_PARALLEL } as any;
    expect(processor?.process(workflowParallelSpan)).toBeUndefined();

    const workflowConditionalSpan = { type: SpanType.WORKFLOW_CONDITIONAL } as any;
    expect(processor?.process(workflowConditionalSpan)).toBeUndefined();

    const workflowConditionalEvalSpan = { type: SpanType.WORKFLOW_CONDITIONAL_EVAL } as any;
    expect(processor?.process(workflowConditionalEvalSpan)).toBeUndefined();

    // Test that other span types pass through
    const modelGenerationSpan = { type: SpanType.MODEL_GENERATION } as any;
    expect(processor?.process(modelGenerationSpan)).toBe(modelGenerationSpan);

    const agentRunSpan = { type: SpanType.AGENT_RUN } as any;
    expect(processor?.process(agentRunSpan)).toBe(agentRunSpan);
  });

  it('handles null/undefined spans in workflow filter', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    const processor = config.spanOutputProcessors?.[0];
    expect(processor).toBeDefined();

    // Should return undefined for undefined spans, null for null spans
    expect(processor?.process(undefined)).toBeUndefined();
    expect(processor?.process(null as any)).toBeNull();
  });

  it('workflow filter shutdown resolves successfully', async () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    const processor = config.spanOutputProcessors?.[0];
    expect(processor).toBeDefined();

    // Shutdown should resolve without error
    await expect(processor?.shutdown()).resolves.toBeUndefined();
  });

  it('appends custom span processors after default filter', () => {
    const customProcessor = {
      name: 'custom-processor',
      process: (span: any) => span,
      shutdown: () => Promise.resolve(),
    };

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      spanProcessors: [customProcessor],
    });

    expect(config.spanOutputProcessors).toHaveLength(2);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('workflow-loop-filter');
    expect(config.spanOutputProcessors?.[1]?.name).toBe('custom-processor');
  });

  it('uses default service name when not provided', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.serviceName).toBe('mastra-tracing');
  });

  it('uses PHOENIX_PROJECT_NAME env var as service name when available', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.serviceName).toBe('phoenix-project');
  });

  it('uses ARIZE_PROJECT_NAME env var as service name when PHOENIX_PROJECT_NAME is not set', () => {
    process.env.ARIZE_PROJECT_NAME = 'arize-project';

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.serviceName).toBe('arize-project');
  });

  it('prioritizes PHOENIX_PROJECT_NAME over ARIZE_PROJECT_NAME', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';
    process.env.ARIZE_PROJECT_NAME = 'arize-project';

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.serviceName).toBe('phoenix-project');
  });

  it('uses provided service name over env vars', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      serviceName: 'custom-service',
    });

    expect(config.serviceName).toBe('custom-service');
  });

  it('creates ArizeExporter with provided exporter config', async () => {
    const { ArizeExporter } = await import('./tracing');
    const arizeExporterSpy = vi.mocked(ArizeExporter);

    const exporterConfig = {
      endpoint: 'https://test-endpoint.com/v1/traces',
      apiKey: 'test-api-key',
      projectName: 'test-project',
    };

    createArizeConfig({
      exporter: exporterConfig,
    });

    expect(arizeExporterSpy).toHaveBeenCalledWith(exporterConfig);
    expect(arizeExporterSpy).toHaveBeenCalledTimes(1);
  });

  it('returns config with single exporter in array', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config.exporters).toHaveLength(1);
    expect(config.exporters?.[0]).toBeDefined();
  });

  it('handles empty span processors array', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      spanProcessors: [],
    });

    expect(config.spanOutputProcessors).toHaveLength(1);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('workflow-loop-filter');
  });

  it('handles multiple custom span processors', () => {
    const processor1 = {
      name: 'processor-1',
      process: (span: any) => span,
      shutdown: () => Promise.resolve(),
    };
    const processor2 = {
      name: 'processor-2',
      process: (span: any) => span,
      shutdown: () => Promise.resolve(),
    };

    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
      spanProcessors: [processor1, processor2],
    });

    expect(config.spanOutputProcessors).toHaveLength(3);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('workflow-loop-filter');
    expect(config.spanOutputProcessors?.[1]?.name).toBe('processor-1');
    expect(config.spanOutputProcessors?.[2]?.name).toBe('processor-2');
  });

  it('returns config without name field', () => {
    const config = createArizeConfig({
      exporter: {
        endpoint: 'https://test-endpoint.com/v1/traces',
      },
    });

    expect(config).not.toHaveProperty('name');
    expect(config).toHaveProperty('serviceName');
    expect(config).toHaveProperty('exporters');
    expect(config).toHaveProperty('serializationOptions');
    expect(config).toHaveProperty('spanOutputProcessors');
  });
});

