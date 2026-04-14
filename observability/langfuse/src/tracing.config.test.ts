import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LangfuseExporter, LANGFUSE_DEFAULT_BASE_URL } from './tracing';

// Track constructor args to verify config is passed correctly
const processorArgs: any[] = [];

vi.mock('@langfuse/otel', () => {
  class MockLangfuseSpanProcessor {
    onStart = vi.fn();
    onEnd = vi.fn();
    forceFlush = vi.fn().mockResolvedValue(undefined);
    shutdown = vi.fn().mockResolvedValue(undefined);
    constructor(params: any) {
      processorArgs.push(params);
    }
  }
  return { LangfuseSpanProcessor: MockLangfuseSpanProcessor };
});

vi.mock('@langfuse/client', () => {
  class MockLangfuseClient {
    score = { create: vi.fn() };
    prompt = {};
    flush = vi.fn().mockResolvedValue(undefined);
    shutdown = vi.fn().mockResolvedValue(undefined);
  }
  return { LangfuseClient: MockLangfuseClient };
});

vi.mock('@mastra/otel-exporter', () => {
  class MockSpanConverter {
    convertSpan = vi.fn();
  }
  return { SpanConverter: MockSpanConverter };
});

describe('LangfuseExporterConfig', () => {
  beforeEach(() => {
    processorArgs.length = 0;
  });

  it('uses default base URL when none provided', () => {
    new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

    expect(processorArgs[0]).toEqual(
      expect.objectContaining({
        baseUrl: LANGFUSE_DEFAULT_BASE_URL,
      }),
    );
  });

  it('uses custom baseUrl', () => {
    new LangfuseExporter({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://my-langfuse.example.com',
    });

    expect(processorArgs[0]).toEqual(
      expect.objectContaining({
        baseUrl: 'https://my-langfuse.example.com',
      }),
    );
  });

  it('strips trailing slashes from baseUrl', () => {
    new LangfuseExporter({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://my-langfuse.example.com///',
    });

    expect(processorArgs[0]).toEqual(
      expect.objectContaining({
        baseUrl: 'https://my-langfuse.example.com',
      }),
    );
  });

  it('reads baseUrl from LANGFUSE_BASE_URL environment variable', () => {
    process.env.LANGFUSE_BASE_URL = 'https://env-langfuse.example.com';
    try {
      new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });

      expect(processorArgs[0]).toEqual(
        expect.objectContaining({
          baseUrl: 'https://env-langfuse.example.com',
        }),
      );
    } finally {
      delete process.env.LANGFUSE_BASE_URL;
    }
  });

  it('passes environment and release to processor', () => {
    new LangfuseExporter({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      environment: 'staging',
      release: '2.0.0',
    });

    expect(processorArgs[0]).toEqual(
      expect.objectContaining({
        environment: 'staging',
        release: '2.0.0',
      }),
    );
  });
});
