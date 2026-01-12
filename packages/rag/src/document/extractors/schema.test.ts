import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { TextNode } from '../schema';
import { SchemaExtractor } from './schema';

vi.setConfig({ testTimeout: 100_000, hookTimeout: 100_000 });

describe('SchemaExtractor', () => {
  const productSchema = z.object({
    productName: z.string(),
    price: z.number(),
    category: z.enum(['electronics', 'clothing']),
  });

  const createMockModel = (responseText: string) => ({
    specificationVersion: 'v2',
    provider: 'mock-provider',
    modelId: 'mock-model',
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'text-delta',
            textDelta: responseText,
            delta: responseText,
            id: 'chunk-1',
          } as any);
          controller.enqueue({
            type: 'text-end',
            id: 'chunk-1',
          } as any);
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
          });
          controller.close();
        },
      });

      // Return the full response structure that createStreamFromGenerateResult expects
      return {
        content: [{ type: 'text', text: responseText }],
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        warnings: [],
        stream,
      };
    },
  });

  it('extracts structured data using a zod schema', async () => {
    // Capture console.error to debug swallowed errors
    let capturedError: any = null;
    const originalError = console.error;
    console.error = (...args: any[]) => {
      capturedError = args;
      originalError(...args);
    };

    try {
      const mockResponse = JSON.stringify({
        productName: 'Test Product',
        price: 99.99,
        category: 'electronics',
      });
      const model = createMockModel(mockResponse);

      const extractor = new SchemaExtractor({
        schema: productSchema,
        llm: model as any,
      });
      const node = new TextNode({ text: 'This is a test product description.' });
      const result = await extractor.extract([node]);

      if (result.length > 0 && Object.keys(result[0]).length === 0 && capturedError) {
        const errorMsg = capturedError
          .map((e: any) => (e instanceof Error ? e.message + '\n' + e.stack : JSON.stringify(e)))
          .join(' ');
        throw new Error(`Schema extraction failed silently. Captured error: ${errorMsg}`);
      }

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        productName: 'Test Product',
        price: 99.99,
        category: 'electronics',
      });
    } finally {
      console.error = originalError;
    }
  });

  it('nests result under metadataKey if provided', async () => {
    const mockResponse = JSON.stringify({
      productName: 'Test Product',
      price: 99.99,
      category: 'electronics',
    });
    const model = createMockModel(mockResponse);

    const extractor = new SchemaExtractor({
      schema: productSchema,
      llm: model as any,
      metadataKey: 'product',
    });
    const node = new TextNode({ text: 'This is a test product description.' });
    const result = await extractor.extract([node]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      product: {
        productName: 'Test Product',
        price: 99.99,
        category: 'electronics',
      },
    });
  });

  it('handles extraction failure gracefully', async () => {
    const model = createMockModel('Not JSON');

    const extractor = new SchemaExtractor({
      schema: productSchema,
      llm: model as any,
    });
    const node = new TextNode({ text: 'This is a test product description.' });
    const result = await extractor.extract([node]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({});
  });
});
