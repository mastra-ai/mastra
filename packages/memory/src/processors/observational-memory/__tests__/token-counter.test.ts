import probeImageSize from 'probe-image-size';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TokenCounter } from '../token-counter';

vi.mock('probe-image-size', () => ({
  default: vi.fn(),
}));

function createMessage(content: any) {
  return {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content,
  } as any;
}

async function createToolResultPartFromExecutedTool({
  toolName,
  args,
  execute,
  toModelOutput,
}: {
  toolName: string;
  args: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  toModelOutput: (output: unknown) => unknown | Promise<unknown>;
}) {
  const result = await execute(args);
  const modelOutput = await toModelOutput(result);

  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: 'tool-1',
      toolName,
      args,
      result,
    },
    providerMetadata: {
      mastra: {
        modelOutput,
      },
    },
  } as const;
}

describe('TokenCounter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.mocked(probeImageSize as any).mockReset();
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('tokenx estimation', () => {
    it('produces correct token counts for basic input', () => {
      const counter = new TokenCounter();
      const tokens = counter.countString('hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('two instances produce identical counts for the same input', () => {
      const a = new TokenCounter();
      const b = new TokenCounter();
      const text = 'The quick brown fox jumps over the lazy dog';

      expect(a.countString(text)).toBe(b.countString(text));
    });

    it('uses a tokenx cache source marker', () => {
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'tokenx cache marker sample' }],
      });

      const counter = new TokenCounter();
      counter.countMessage(message);

      expect(message.content.parts[0].providerMetadata.mastra.tokenEstimate.source).toContain('tokenx');
    });
  });

  describe('countString', () => {
    it('returns 0 for empty string', () => {
      const counter = new TokenCounter();
      expect(counter.countString('')).toBe(0);
    });

    it('returns 0 for falsy input', () => {
      const counter = new TokenCounter();
      expect(counter.countString(null as any)).toBe(0);
      expect(counter.countString(undefined as any)).toBe(0);
    });
  });

  describe('image counting', () => {
    it('counts image url parts with a stable integer estimate', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: new URL('https://example.com/cat.png') }],
      });

      const tokens = counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(80);
      expect(Number.isInteger(tokens)).toBe(true);
      expect(cachedEntry.tokens).toBe(85);
    });

    it('treats http image strings as urls instead of base64 payloads', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: 'https://example.com/cat.png' }],
      });

      const tokens = counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(80);
      expect(tokens).toBeLessThan(200);
      expect(cachedEntry.tokens).toBe(85);
    });

    it('probes remote image url dimensions during async local fallback when metadata is missing', async () => {
      vi.mocked(probeImageSize as any).mockResolvedValue({ width: 2048, height: 1024 });

      const counter = new TokenCounter({ model: 'test-model' as any });
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: 'https://example.com/cat.png' }],
      });

      const tokens = await counter.countMessageAsync(message);
      const part = message.content.parts[0];

      expect(probeImageSize).toHaveBeenCalledWith(
        'https://example.com/cat.png',
        expect.objectContaining({
          open_timeout: 2500,
          response_timeout: 2500,
          read_timeout: 2500,
          follow_max: 2,
        }),
      );
      expect(part.providerMetadata.mastra.imageDimensions).toEqual({ width: 2048, height: 1024 });
      expect(part.providerMetadata.mastra.tokenEstimate.tokens).toBe(1105);
      expect(tokens).toBeGreaterThan(1100);
    });

    it('uses the provider endpoint before probing remote image dimensions', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ input_tokens: 1851 }),
      });
      globalThis.fetch = fetchMock as typeof fetch;

      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: 'https://example.com/cat.png' }],
      });

      const tokens = await counter.countMessageAsync(message);

      expect(tokens).toBeGreaterThan(1800);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(probeImageSize).not.toHaveBeenCalled();
    });

    it('reuses cached remote attachment counts on async recounts', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
      vi.mocked(probeImageSize as any).mockResolvedValue({ width: 2048, height: 1024 });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ input_tokens: 1851 }),
      });
      globalThis.fetch = fetchMock as typeof fetch;

      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: 'https://example.com/cat.png' }],
      });

      const firstTokens = await counter.countMessageAsync(message);
      const secondTokens = await counter.countMessageAsync(message);

      expect(firstTokens).toBe(secondTokens);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('dedupes in-flight remote attachment counts for identical attachments', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
      const fetchMock = vi.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ input_tokens: 130 }),
              });
            }, 10);
          }),
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const createPdfMessage = () =>
        createMessage({
          format: 2,
          parts: [
            {
              type: 'file',
              data: 'https://example.com/specs/floorplan.pdf',
              mimeType: 'application/pdf',
              filename: 'floorplan.pdf',
            },
          ],
        });

      const [firstTokens, secondTokens] = await Promise.all([
        counter.countMessageAsync(createPdfMessage()),
        counter.countMessageAsync(createPdfMessage()),
      ]);

      expect(firstTokens).toBe(secondTokens);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not treat non-attachment parts as remote-count eligible', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as typeof fetch;

      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const message = createMessage({
        format: 2,
        parts: [
          { type: 'text', text: 'hello world' },
          { type: 'data-om-status', data: { active: true } },
        ],
      });

      await counter.countMessageAsync(message);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('extracts inline image dimensions from image bytes when metadata is missing', () => {
      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
          },
        ],
      });

      const tokens = counter.countMessage(message);
      const part = message.content.parts[0];

      expect(tokens).toBeGreaterThan(80);
      expect(part.providerMetadata.mastra.imageDimensions).toEqual({ width: 1, height: 1 });
      expect(part.providerMetadata.mastra.tokenEstimate.tokens).toBe(85);
    });

    it('counts data-uri image parts with deterministic fallback sizing', () => {
      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const dataUriImage = `data:image/png;base64,${'a'.repeat(2000000)}`;
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: dataUriImage }],
      });

      const tokens = counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(700);
      expect(cachedEntry.tokens).toBe(765);
    });

    it('counts image-like file parts by mime type instead of serializing the full payload', () => {
      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const dataUriImage = `data:image/png;base64,${'a'.repeat(2000000)}`;
      const message = createMessage({
        format: 2,
        parts: [{ type: 'file', data: dataUriImage, mimeType: 'image/png', filename: 'cat.png' }],
      });

      const tokens = counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(700);
      expect(tokens).toBeLessThan(1000);
      expect(cachedEntry.tokens).toBe(765);
    });

    it('counts image-like file parts by filename when mime type is missing or generic', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: new URL('https://example.com/reference-board.png'),
            mimeType: 'application/octet-stream',
          },
        ],
      });

      const tokens = counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(80);
      expect(tokens).toBeLessThan(200);
      expect(cachedEntry.tokens).toBe(85);
    });

    it('counts non-image file parts from descriptors instead of raw payload bytes', () => {
      const counter = new TokenCounter();
      const pdfUrlMessage = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: 'https://example.com/specs/floorplan.pdf',
            mimeType: 'application/pdf',
            filename: 'floorplan.pdf',
          },
        ],
      });
      const uploadedPdfMessage = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: `data:application/pdf;base64,${'a'.repeat(200000)}`,
            mimeType: 'application/pdf',
            filename: 'floorplan.pdf',
          },
        ],
      });

      const pdfUrlTokens = counter.countMessage(pdfUrlMessage);
      const uploadedPdfTokens = counter.countMessage(uploadedPdfMessage);

      expect(pdfUrlTokens).toBeGreaterThan(0);
      expect(uploadedPdfTokens).toBeGreaterThan(0);
      expect(uploadedPdfTokens).toBeLessThan(500);
      expect(Math.abs(uploadedPdfTokens - pdfUrlTokens)).toBeLessThan(50);
    });

    it('reuses cached image estimates across repeated counts', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: new URL('https://example.com/cached.png') }],
      });

      const first = counter.countMessage(message);
      const firstEntry = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;
      const second = counter.countMessage(message);
      const secondEntry = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(second).toBe(first);
      expect(secondEntry).toEqual(firstEntry);
    });

    it('changes image estimates when resolved model context changes', () => {
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image: new URL('https://example.com/high-detail.png'),
            providerOptions: {
              openai: {
                detail: 'high',
              },
            },
            providerMetadata: {
              mastra: {
                imageDimensions: {
                  width: 1024,
                  height: 1024,
                },
              },
            },
          },
        ],
      });

      const defaultCounter = new TokenCounter({ model: 'openai/gpt-4o' });
      const miniCounter = new TokenCounter({ model: 'openai/gpt-4o-mini' });

      const defaultTokens = defaultCounter.countMessage(message);
      const defaultCache = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      const defaultCachedEntry = (Object.values(defaultCache).find((entry: any) => entry?.tokens === 765) ??
        defaultCache) as any;

      const miniTokens = miniCounter.countMessage(message);
      const miniCache = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      const miniCachedEntry = Object.values(miniCache).find((entry: any) => entry?.tokens === 25501) as any;

      expect(defaultTokens).toBeGreaterThan(765);
      expect(defaultCachedEntry.tokens).toBe(765);
      expect(miniTokens).toBeGreaterThan(defaultTokens);
      expect(miniCachedEntry?.tokens).toBe(25501);
      expect(miniCachedEntry?.key).not.toBe(defaultCachedEntry.key);
    });

    it('uses google media resolution when the provider is google', () => {
      const counter = new TokenCounter({
        model: { provider: 'google', modelId: 'gemini-3-flash-preview' },
      });
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image: new URL('https://example.com/diagram.png'),
            providerOptions: {
              google: {
                mediaResolution: 'medium',
              },
            },
          },
        ],
      });

      counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(cachedEntry.tokens).toBe(560);
    });

    it('uses anthropic image sizing when the provider is anthropic even if the model id looks openai-ish', () => {
      const counter = new TokenCounter({
        model: { provider: 'anthropic', modelId: 'gpt-4o' },
      });
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image: new URL('https://example.com/reference-board.png'),
            providerMetadata: {
              mastra: {
                imageDimensions: {
                  width: 750,
                  height: 750,
                },
              },
            },
          },
        ],
      });

      counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(cachedEntry.tokens).toBe(750);
    });

    it('uses legacy google tiling for pre-gemini-3 google models', () => {
      const counter = new TokenCounter({
        model: { provider: 'google', modelId: 'gemini-2.5-flash' },
      });
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image: new URL('https://example.com/map.png'),
            providerMetadata: {
              mastra: {
                imageDimensions: {
                  width: 769,
                  height: 769,
                },
              },
            },
          },
        ],
      });

      counter.countMessage(message);
      const cachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(cachedEntry.tokens).toBe(1032);
    });
  });

  describe('token estimate cache', () => {
    it('writes and reuses part-level token estimates on text parts across repeated counts', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Hello from cached text part' }],
      });

      const first = counter.countMessage(message);
      expect(first).toBeGreaterThan(0);
      const firstEntry = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;
      expect(firstEntry).toBeTruthy();

      const second = counter.countMessage(message);
      const secondEntry = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(second).toBe(first);
      expect(secondEntry).toEqual(firstEntry);

      const reloaded = {
        ...JSON.parse(JSON.stringify(message)),
        createdAt: new Date(message.createdAt),
      };

      const third = counter.countMessage(reloaded as any);
      const thirdEntry = reloaded.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(third).toBe(first);
      expect(thirdEntry).toEqual(firstEntry);
      expect(reloaded.content.parts[0].providerMetadata?.mastra?.tokenEstimate).toBeTruthy();
    });

    it('ignores stale cache entries when the cache key no longer matches', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Original text payload' }],
      });

      counter.countMessage(message);
      const firstEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;

      message.content.parts[0].text = 'Mutated text payload with different size and tokens';
      const recounted = counter.countMessage(message);
      const secondEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;

      expect(recounted).toBeGreaterThan(0);
      expect(secondEntry).toBeTruthy();
      expect(secondEntry.key).not.toBe(firstEntry.key);
      expect(secondEntry.tokens).not.toBe(firstEntry.tokens);
    });

    it('recomputes when version or source markers mismatch', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Version source mismatch sample text' }],
      });

      counter.countMessage(message);
      const entry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;

      message.content.parts[0].providerMetadata.mastra.tokenEstimate = {
        ...entry,
        v: entry.v + 1,
      };
      counter.countMessage(message);
      const versionRefreshed = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      expect(versionRefreshed.v).toBe(entry.v);

      message.content.parts[0].providerMetadata.mastra.tokenEstimate = {
        ...versionRefreshed,
        source: `${versionRefreshed.source}-mismatch`,
      };
      counter.countMessage(message);
      const sourceRefreshed = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      expect(sourceRefreshed.source).toBe(entry.source);
    });

    it('uses a stable estimator-scoped cache source', () => {
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Same payload, stable estimator identity' }],
      });

      const firstCounter = new TokenCounter();
      firstCounter.countMessage(message);
      const firstEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;

      const secondCounter = new TokenCounter();
      secondCounter.countMessage(message);

      const refreshedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      expect(refreshedEntry.source).toBe(firstEntry.source);
      expect(refreshedEntry.source).toContain('tokenx');
    });

    it('keeps data-* and reasoning skipped/uncached while caching eligible parts', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          { type: 'text', text: 'count me' },
          { type: 'data-om-activation', data: { x: 1 } },
          { type: 'reasoning', text: 'do not include this' },
        ],
      });

      counter.countMessage(message);

      expect(message.content.parts[0].providerMetadata?.mastra?.tokenEstimate).toBeTruthy();
      expect(message.content.parts[1].providerMetadata?.mastra?.tokenEstimate).toBeUndefined();
      expect(message.content.parts[2].providerMetadata?.mastra?.tokenEstimate).toBeUndefined();
    });

    it('caches string-content fallback on content.metadata.mastra', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        content: 'Legacy string content path for fallback caching',
      });

      const first = counter.countMessage(message);
      expect(first).toBeGreaterThan(0);
      expect(message.content.metadata?.mastra?.tokenEstimate).toBeTruthy();

      const cachedEntry = message.content.metadata.mastra.tokenEstimate;
      const second = counter.countMessage(message);

      expect(second).toBe(first);
      expect(message.content.metadata.mastra.tokenEstimate).toEqual(cachedEntry);
    });

    it('keeps overhead dynamic even when part payloads are cached', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: 'tool-1',
              toolName: 'lookup',
              args: { q: 'weather in sf' },
            },
          },
        ],
      });

      const initial = counter.countMessage(message);
      const stable = counter.countMessage(message);
      expect(stable).toBe(initial);

      message.content.parts.push({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tool-1',
          toolName: 'lookup',
          result: { answer: 'sunny' },
        },
      });

      const withToolResult = counter.countMessage(message);
      const withToolResultAgain = counter.countMessage(message);

      expect(withToolResult).not.toBe(initial);
      expect(withToolResultAgain).toBe(withToolResult);
    });

    it('prefers stored mastra.modelOutput over raw tool results for token counting', async () => {
      const counter = new TokenCounter();
      const args = { q: 'weather in sf' };
      const rawResult = {
        longPayload: Array.from({ length: 200 }, (_, i) => `entry-${i}-${'very-large-result-'.repeat(5)}`),
      };

      const weatherTool = {
        execute: async (_args: Record<string, unknown>) => rawResult,
        toModelOutput: async (output: unknown) => {
          const entryCount = (output as { longPayload: string[] }).longPayload.length;
          return { type: 'text', value: `sunny, 72°F (${entryCount} entries summarized)` };
        },
      };

      const executedResult = await weatherTool.execute(args);
      const withoutModelOutput = createMessage({
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'lookup',
              args,
              result: executedResult,
            },
          },
        ],
      });

      const withModelOutput = createMessage({
        format: 2,
        parts: [
          await createToolResultPartFromExecutedTool({
            toolName: 'lookup',
            args,
            execute: weatherTool.execute,
            toModelOutput: weatherTool.toModelOutput,
          }),
        ],
      });

      const rawResultTokens = counter.countMessage(withoutModelOutput);
      const modelOutputTokens = counter.countMessage(withModelOutput);

      expect(modelOutputTokens).toBeLessThan(rawResultTokens);
    });

    it('recomputes tool-result estimates when stored modelOutput changes', async () => {
      const counter = new TokenCounter();
      const args = { q: 'weather in sf' };
      const weatherTool = {
        execute: async (_args: Record<string, unknown>) => ({
          longPayload: Array.from({ length: 200 }, (_, i) => `entry-${i}-${'very-large-result-'.repeat(5)}`),
        }),
        toModelOutput: async () => ({ type: 'text', value: 'brief output' }),
      };

      const message = createMessage({
        format: 2,
        parts: [
          await createToolResultPartFromExecutedTool({
            toolName: 'lookup',
            args,
            execute: weatherTool.execute,
            toModelOutput: weatherTool.toModelOutput,
          }),
        ],
      });

      const first = counter.countMessage(message);
      const firstEstimate = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      message.content.parts[0].providerMetadata.mastra.modelOutput = {
        type: 'text',
        value: 'expanded output '.repeat(40),
      };

      const second = counter.countMessage(message);
      const secondEstimate = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(second).toBeGreaterThan(first);
      expect(secondEstimate.key).not.toBe(firstEstimate.key);
    });

    it('sanitizes and truncates raw tool results while counting tokens', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'web_search_20250305',
              args: { q: 'search query' },
              result: {
                encryptedContent: 'z'.repeat(10000),
                snippet: 'result '.repeat(5000),
              },
            },
          },
        ],
      });

      const tokens = counter.countMessage(message);
      const estimate = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(tokens).toBeGreaterThan(0);
      expect(estimate?.key).toContain('tool-result-json');
      expect(estimate?.tokens).toBeLessThan(
        counter.countString(JSON.stringify(message.content.parts[0].toolInvocation.result)),
      );
    });
  });

  describe('countObservations', () => {
    it('delegates to countString', () => {
      const counter = new TokenCounter();
      const text = 'Some observation text';
      expect(counter.countObservations(text)).toBe(counter.countString(text));
    });
  });
});
