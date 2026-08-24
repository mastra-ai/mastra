import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockExtract, mockParallel } = vi.hoisted(() => {
  const mockSearch = vi.fn();
  const mockExtract = vi.fn();
  return {
    mockSearch,
    mockExtract,
    mockParallel: vi.fn(function ParallelClient() {
      return { search: mockSearch, extract: mockExtract };
    }),
  };
});

vi.mock('parallel-web', () => ({ default: mockParallel }));

import { createParallelExtractTool } from './extract.js';

describe('createParallelExtractTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue({
      extract_id: 'extract_test',
      session_id: 'session_test',
      results: [
        {
          url: 'https://mastra.ai/docs',
          title: 'Mastra documentation',
          publish_date: '2026-08-21',
          excerpts: ['Relevant Mastra documentation.'],
          full_content: '# Mastra documentation',
        },
      ],
      errors: [
        {
          url: 'https://example.com/missing',
          error_type: 'http_error',
          http_status_code: 404,
          content: 'Not found',
        },
      ],
      usage: [{ name: 'sku_extract', count: 1 }],
      warnings: [{ type: 'input_validation_warning', message: 'A test warning', detail: null }],
    });
  });

  it('creates a Mastra tool without constructing the client', () => {
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    expect(tool.id).toBe('parallel-extract');
    expect(tool.description).toContain('Parallel');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(mockParallel).not.toHaveBeenCalled();
  });

  it('maps the complete camel-case input and normalizes results and errors', async () => {
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    const result = await tool.execute!(
      {
        urls: ['https://mastra.ai/docs', 'https://example.com/missing'],
        objective: 'Extract the current tool documentation.',
        searchQueries: ['Mastra tool documentation'],
        clientModel: 'anthropic/claude-sonnet-4-6',
        excerptMaxCharsPerResult: 3000,
        fullContent: 10000,
        maxCharsTotal: 16000,
        fetchPolicy: { maxAgeSeconds: 600, timeoutSeconds: 15, disableCacheFallback: false },
        sessionId: 'session_input',
      },
      {} as any,
    );

    expect(mockExtract).toHaveBeenCalledWith({
      urls: ['https://mastra.ai/docs', 'https://example.com/missing'],
      objective: 'Extract the current tool documentation.',
      search_queries: ['Mastra tool documentation'],
      client_model: 'anthropic/claude-sonnet-4-6',
      max_chars_total: 16000,
      session_id: 'session_input',
      advanced_settings: {
        excerpt_settings: { max_chars_per_result: 3000 },
        full_content: { max_chars_per_result: 10000 },
        fetch_policy: {
          max_age_seconds: 600,
          timeout_seconds: 15,
          disable_cache_fallback: false,
        },
      },
    });
    expect(result).toEqual({
      extractId: 'extract_test',
      sessionId: 'session_test',
      results: [
        {
          url: 'https://mastra.ai/docs',
          title: 'Mastra documentation',
          publishDate: '2026-08-21',
          excerpts: ['Relevant Mastra documentation.'],
          fullContent: '# Mastra documentation',
        },
      ],
      errors: [
        {
          url: 'https://example.com/missing',
          errorType: 'http_error',
          httpStatusCode: 404,
          content: 'Not found',
        },
      ],
      usage: [{ name: 'sku_extract', count: 1 }],
      warnings: [{ type: 'input_validation_warning', message: 'A test warning', detail: undefined }],
    });
  });

  it('maps boolean full-content configuration', async () => {
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    await tool.execute!({ urls: ['https://mastra.ai'], fullContent: false }, {} as any);

    expect(mockExtract).toHaveBeenCalledWith({
      urls: ['https://mastra.ai'],
      advanced_settings: { excerpt_settings: undefined, full_content: false },
    });
  });

  it('sends only URLs for minimal input and reuses the client', async () => {
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    await tool.execute!({ urls: ['https://mastra.ai'] }, {} as any);
    await tool.execute!({ urls: ['https://mastra.ai/docs'] }, {} as any);

    expect(mockExtract).toHaveBeenNthCalledWith(1, { urls: ['https://mastra.ai'] });
    expect(mockExtract).toHaveBeenNthCalledWith(2, { urls: ['https://mastra.ai/docs'] });
    expect(mockParallel).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid URL collections before execution', () => {
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    expect(() => tool.inputSchema!.parse({ urls: [] })).toThrow();
    expect(() => tool.inputSchema!.parse({ urls: ['not-a-url'] })).toThrow();
  });

  it('propagates SDK errors', async () => {
    mockExtract.mockRejectedValue(new Error('Parallel extract failed'));
    const tool = createParallelExtractTool({ apiKey: 'parallel-test' });

    await expect(tool.execute!({ urls: ['https://mastra.ai'] }, {} as any)).rejects.toThrow('Parallel extract failed');
  });
});
