import { SamplingStrategyType } from '@mastra/core/observability';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createArizeConfig } from './config';
import { ArizeExporter } from './tracing';

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
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
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
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
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
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
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

  it('passes through spanOutputProcessors', () => {
    const customProcessor = {
      name: 'custom-processor',
      process: (span: any) => span,
      shutdown: () => Promise.resolve(),
    };

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      spanOutputProcessors: [customProcessor],
    });

    expect(config.spanOutputProcessors).toHaveLength(1);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('custom-processor');
  });

  it('uses default service name when not provided', () => {
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
    });

    expect(config.serviceName).toBe('mastra-tracing');
  });

  it('uses PHOENIX_PROJECT_NAME env var as service name when available', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
    });

    expect(config.serviceName).toBe('phoenix-project');
  });

  it('uses ARIZE_PROJECT_NAME env var as service name when PHOENIX_PROJECT_NAME is not set', () => {
    process.env.ARIZE_PROJECT_NAME = 'arize-project';

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
    });

    expect(config.serviceName).toBe('arize-project');
  });

  it('prioritizes PHOENIX_PROJECT_NAME over ARIZE_PROJECT_NAME', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';
    process.env.ARIZE_PROJECT_NAME = 'arize-project';

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
    });

    expect(config.serviceName).toBe('phoenix-project');
  });

  it('uses provided service name over env vars', () => {
    process.env.PHOENIX_PROJECT_NAME = 'phoenix-project';

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      serviceName: 'custom-service',
    });

    expect(config.serviceName).toBe('custom-service');
  });

  it('passes through exporters array', () => {
    const exporter1 = new ArizeExporter({
      endpoint: 'https://test-endpoint.com/v1/traces',
    });
    const exporter2 = new ArizeExporter({
      endpoint: 'https://test-endpoint-2.com/v1/traces',
    });

    const config = createArizeConfig({
      exporters: [exporter1, exporter2],
    });

    expect(config.exporters).toHaveLength(2);
    expect(config.exporters?.[0]).toBe(exporter1);
    expect(config.exporters?.[1]).toBe(exporter2);
  });

  it('returns config with exporters array', () => {
    const exporter = new ArizeExporter({
      endpoint: 'https://test-endpoint.com/v1/traces',
    });

    const config = createArizeConfig({
      exporters: [exporter],
    });

    expect(config.exporters).toHaveLength(1);
    expect(config.exporters?.[0]).toBe(exporter);
  });

  it('passes through empty span processors array', () => {
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      spanOutputProcessors: [],
    });

    expect(config.spanOutputProcessors).toHaveLength(0);
  });

  it('passes through multiple custom span processors', () => {
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
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      spanOutputProcessors: [processor1, processor2],
    });

    expect(config.spanOutputProcessors).toHaveLength(2);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('processor-1');
    expect(config.spanOutputProcessors?.[1]?.name).toBe('processor-2');
  });

  it('returns config without name field', () => {
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
    });

    expect(config).not.toHaveProperty('name');
    expect(config).toHaveProperty('serviceName');
    expect(config).toHaveProperty('exporters');
    expect(config).toHaveProperty('serializationOptions');
  });

  it('passes through sampling strategy', () => {
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
    });

    expect(config.sampling).toEqual({ type: SamplingStrategyType.RATIO, probability: 0.5 });
  });

  it('passes through includeInternalSpans', () => {
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      includeInternalSpans: true,
    });

    expect(config.includeInternalSpans).toBe(true);
  });

  it('passes through requestContextKeys', () => {
    const requestContextKeys = ['user.id', 'session.data'];
    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      requestContextKeys,
    });

    expect(config.requestContextKeys).toEqual(requestContextKeys);
  });

  it('passes through bridge', () => {
    const mockBridge = {
      name: 'test-bridge',
      exportTracingEvent: vi.fn(),
      shutdown: vi.fn(),
      flush: vi.fn(),
    };

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      bridge: mockBridge as any,
    });

    expect(config.bridge).toBe(mockBridge);
  });

  it('passes through all properties together', () => {
    const mockBridge = {
      name: 'test-bridge',
      exportTracingEvent: vi.fn(),
      shutdown: vi.fn(),
      flush: vi.fn(),
    };
    const customProcessor = {
      name: 'custom-processor',
      process: (span: any) => span,
      shutdown: () => Promise.resolve(),
    };

    const config = createArizeConfig({
      exporters: [
        new ArizeExporter({
          endpoint: 'https://test-endpoint.com/v1/traces',
        }),
      ],
      serviceName: 'custom-service',
      sampling: { type: SamplingStrategyType.NEVER },
      includeInternalSpans: true,
      requestContextKeys: ['user.id'],
      bridge: mockBridge as any,
      spanOutputProcessors: [customProcessor],
      serializationOptions: {
        maxStringLength: 5000,
      },
    });

    expect(config.serviceName).toBe('custom-service');
    expect(config.sampling).toEqual({ type: SamplingStrategyType.NEVER });
    expect(config.includeInternalSpans).toBe(true);
    expect(config.requestContextKeys).toEqual(['user.id']);
    expect(config.bridge).toBe(mockBridge);
    expect(config.serializationOptions).toEqual({
      maxStringLength: 5000,
      maxDepth: 9999999,
      maxArrayLength: 9999999,
      maxObjectKeys: 9999999,
    });
    expect(config.spanOutputProcessors).toHaveLength(1);
    expect(config.spanOutputProcessors?.[0]?.name).toBe('custom-processor');
  });
});

