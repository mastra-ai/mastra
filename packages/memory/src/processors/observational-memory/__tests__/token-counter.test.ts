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

    it('keeps URL-only non-image files on descriptor-only local counting', () => {
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

      const pdfUrlTokens = counter.countMessage(pdfUrlMessage);

      // URL-only file parts have no measurable body, so they fall back to the
      // small descriptor-only estimate.
      expect(pdfUrlTokens).toBeGreaterThan(0);
      expect(pdfUrlTokens).toBeLessThan(50);
    });

    // The local/sync counting path used to count only the descriptor JSON
    // (~8 tokens) for inline file bodies, so the Observational Memory
    // threshold never tripped on large attachments. Local counting now
    // estimates token cost from the attachment's byte size and mime type
    // so large inline files are reflected in OM and context budgets.
    // (countMessagesAsync() can still use provider token-count endpoints
    // for supported providers; this only improves the local fallback.)
    it('counts inline PDF file bytes instead of only the file descriptor', () => {
      const counter = new TokenCounter();
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

      const uploadedPdfTokens = counter.countMessage(uploadedPdfMessage);

      // 200_000 base64 chars decodes to ~150_000 bytes; with the default
      // PDF heuristic (bytes/4) that's ~37_500 tokens — well above the
      // ~8-token descriptor estimate that used to be returned.
      expect(uploadedPdfTokens).toBeGreaterThan(10_000);
    });

    it('scales local non-image file estimates with byte size for text mime types', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: `data:text/plain;base64,${Buffer.from('x'.repeat(40_000)).toString('base64')}`,
            mimeType: 'text/plain',
            filename: 'notes.txt',
          },
        ],
      });

      const tokens = counter.countMessage(message);

      // 40_000 bytes / 4 ≈ 10_000 tokens (well over the descriptor estimate).
      expect(tokens).toBeGreaterThan(5_000);
    });

    it('produces a smaller estimate for Google PDFs than Anthropic PDFs of the same size', () => {
      const data = `data:application/pdf;base64,${'a'.repeat(200000)}`;
      const buildMessage = () =>
        createMessage({
          format: 2,
          parts: [{ type: 'file', data, mimeType: 'application/pdf', filename: 'doc.pdf' }],
        });

      const googleCounter = new TokenCounter({
        model: { provider: 'google', modelId: 'gemini-2.5-flash' },
      });
      const anthropicCounter = new TokenCounter({
        model: { provider: 'anthropic', modelId: 'claude-3-5-sonnet' },
      });

      const googleTokens = googleCounter.countMessage(buildMessage());
      const anthropicTokens = anthropicCounter.countMessage(buildMessage());

      // Google bills PDFs at 258 tokens/page (~5KB/page); Anthropic bills at
      // 1500–3000 tokens/page. So for any given non-trivial size Google's
      // estimate is significantly smaller.
      expect(googleTokens).toBeLessThan(anthropicTokens);
    });

    it('normalizes mime type casing and parameters when picking the PDF heuristic', () => {
      const data = `data:application/pdf;base64,${'a'.repeat(200000)}`;
      const buildMessage = (mimeType: string) =>
        createMessage({
          format: 2,
          parts: [{ type: 'file', data, mimeType, filename: 'doc.pdf' }],
        });

      const anthropicCounter = new TokenCounter({
        model: { provider: 'anthropic', modelId: 'claude-3-5-sonnet' },
      });

      const canonical = anthropicCounter.countMessage(buildMessage('application/pdf'));
      const uppercased = new TokenCounter({
        model: { provider: 'anthropic', modelId: 'claude-3-5-sonnet' },
      }).countMessage(buildMessage('Application/PDF'));
      const parameterized = new TokenCounter({
        model: { provider: 'anthropic', modelId: 'claude-3-5-sonnet' },
      }).countMessage(buildMessage('application/pdf; charset=binary'));

      expect(uppercased).toBe(canonical);
      expect(parameterized).toBe(canonical);
    });

    it('reuses cached local non-image file estimates across fresh TokenCounter instances', () => {
      const part: Record<string, any> = {
        type: 'file',
        data: `data:application/pdf;base64,${'a'.repeat(200000)}`,
        mimeType: 'application/pdf',
        filename: 'cached.pdf',
      };
      const message = createMessage({ format: 2, parts: [part] });

      const first = new TokenCounter().countMessage(message);
      const cachedAfterFirst = part.providerMetadata?.mastra?.tokenEstimate;
      const second = new TokenCounter().countMessage(message);

      expect(second).toBe(first);
      // The byte-size estimate is persisted under the new 'non-image-file'
      // cache source so subsequent counters re-use it without recomputing.
      expect(cachedAfterFirst).toBeDefined();
    });

    // Pipelines that strip the real binary payload before persistence (e.g.
    // uploading to cloud storage and leaving a hidden reference token in the
    // `data` field) cannot rely on the on-device file size. They can stamp an
    // authoritative estimate via `providerMetadata.mastra.tokenEstimate` so
    // Observational Memory thresholds and context budgets account for it.
    it('honors a client-supplied tokenEstimate on non-image file parts', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: 'storage://bucket/abc123',
            mimeType: 'application/pdf',
            filename: 'real-on-cloud.pdf',
            providerMetadata: {
              mastra: {
                tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 25_000 },
              },
            },
          },
        ],
      });

      const tokens = counter.countMessage(message);

      expect(tokens).toBeGreaterThanOrEqual(25_000);
    });

    it('honors a client-supplied tokenEstimate on image parts', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'image',
            image: new URL('https://example.com/cloud-ref.png'),
            providerMetadata: {
              mastra: {
                tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 5_000 },
              },
            },
          },
        ],
      });

      const tokens = counter.countMessage(message);

      expect(tokens).toBeGreaterThanOrEqual(5_000);
    });

    it('preserves a client-supplied tokenEstimate across repeated counts', () => {
      const part: Record<string, any> = {
        type: 'file',
        data: 'storage://bucket/abc123',
        mimeType: 'application/pdf',
        filename: 'real-on-cloud.pdf',
        providerMetadata: {
          mastra: {
            tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 42_000 },
          },
        },
      };
      const message = createMessage({ format: 2, parts: [part] });

      const first = new TokenCounter().countMessage(message);
      const second = new TokenCounter().countMessage(message);

      expect(second).toBe(first);
      const cache = part.providerMetadata.mastra.tokenEstimate;
      const clientEntry =
        cache?.source === 'client' ? cache : Object.values(cache).find((entry: any) => entry?.source === 'client');
      expect(clientEntry).toMatchObject({ source: 'client', tokens: 42_000 });
    });

    it('falls back to the default estimator when the client tokenEstimate is invalid', () => {
      const buildMessage = (tokens: unknown) =>
        createMessage({
          format: 2,
          parts: [
            {
              type: 'file',
              data: `data:application/pdf;base64,${'a'.repeat(200000)}`,
              mimeType: 'application/pdf',
              filename: 'with-invalid-estimate.pdf',
              providerMetadata: {
                mastra: {
                  tokenEstimate: { v: 0, source: 'client', key: 'client', tokens },
                },
              },
            },
          ],
        });

      const baseline = new TokenCounter().countMessage(
        createMessage({
          format: 2,
          parts: [
            {
              type: 'file',
              data: `data:application/pdf;base64,${'a'.repeat(200000)}`,
              mimeType: 'application/pdf',
              filename: 'with-invalid-estimate.pdf',
            },
          ],
        }),
      );

      const counter = new TokenCounter();
      const nan = counter.countMessage(buildMessage(Number.NaN));
      const negative = counter.countMessage(buildMessage(-1));
      const nonNumeric = counter.countMessage(buildMessage('lots'));

      // Invalid values fall through to the framework auto-estimator, not the
      // raw stringified value the caller supplied.
      expect(nan).toBe(baseline);
      expect(negative).toBe(baseline);
      expect(nonNumeric).toBe(baseline);
    });

    it('does not call provider fetches when a client tokenEstimate is present', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as typeof fetch;

      const counter = new TokenCounter({ model: 'openai/gpt-4o' });
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'file',
            data: 'storage://bucket/abc123',
            mimeType: 'application/pdf',
            filename: 'real-on-cloud.pdf',
            providerMetadata: {
              mastra: {
                tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 25_000 },
              },
            },
          },
        ],
      });

      const tokens = await counter.countMessageAsync(message);

      expect(tokens).toBeGreaterThanOrEqual(25_000);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ignores client tokenEstimate on non-attachment parts (text/tool-invocation)', async () => {
      const counter = new TokenCounter();
      const text = 'hello world';
      const baselineMessage = createMessage({
        format: 2,
        parts: [{ type: 'text', text }],
      });
      const baseline = counter.countMessage(baselineMessage);

      const messageWithBogusEstimate = createMessage({
        format: 2,
        parts: [
          {
            type: 'text',
            text,
            providerMetadata: {
              mastra: {
                tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 999_999 },
              },
            },
          } as any,
        ],
      });

      const sync = counter.countMessage(messageWithBogusEstimate);
      const async_ = await counter.countMessageAsync(messageWithBogusEstimate);

      expect(sync).toBe(baseline);
      expect(async_).toBe(baseline);
      expect(sync).toBeLessThan(500);
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

    it('counts stored multimodal tool modelOutput as media instead of base64 JSON text', () => {
      const counter = new TokenCounter();
      const modelOutput = {
        type: 'content',
        value: [
          { type: 'text', text: 'Calculator screenshot' },
          { type: 'image-data', data: 'a'.repeat(200_000), mediaType: 'image/png' },
        ],
      };
      const message = createMessage({
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'cua_screenshot',
              result: { content: [{ type: 'image', data: 'a'.repeat(200_000), mimeType: 'image/png' }] },
            },
            providerMetadata: {
              mastra: { modelOutput },
            },
          },
        ],
      });

      const tokens = counter.countMessage(message);
      const estimate = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeLessThan(2_000);
      expect(estimate.key).toContain('tool-result-multimodal-content');
      expect(estimate.tokens).toBeLessThan(counter.countString(JSON.stringify(modelOutput)));
    });

    it('counts raw MCP multimodal tool results as media instead of base64 JSON text', () => {
      const counter = new TokenCounter();
      const rawResultWithoutMalformed = {
        content: [
          { type: 'text', text: 'Calculator screenshot' },
          { type: 'image', data: 'a'.repeat(200_000), mimeType: 'image/png' },
        ],
      };
      const rawResult = {
        content: [...rawResultWithoutMalformed.content, { type: 'audio', mimeType: 'audio/wav' }],
      };
      const createScreenshotMessage = (result: unknown) =>
        createMessage({
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-1',
                toolName: 'cua_screenshot',
                result,
              },
            },
          ],
        });
      const message = createScreenshotMessage(rawResult);
      const messageWithoutMalformed = createScreenshotMessage(rawResultWithoutMalformed);

      const tokens = counter.countMessage(message);
      const tokensWithoutMalformed = counter.countMessage(messageWithoutMalformed);
      const estimate = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(tokens).toBeGreaterThan(tokensWithoutMalformed);
      expect(tokens).toBeLessThan(2_000);
      expect(estimate.key).toContain('tool-result-multimodal-content');
      expect(estimate.tokens).toBeLessThan(counter.countString(JSON.stringify(rawResult)));
    });

    it('honors client-supplied tokenEstimate on raw MCP multimodal content parts', () => {
      const counter = new TokenCounter();
      const createCloudResult = (withClientEstimates: boolean) => ({
        content: [
          { type: 'text', text: 'Cloud-hosted multimodal result' },
          {
            type: 'image',
            data: 'storage://bucket/screenshot-ref',
            mimeType: 'image/png',
            ...(withClientEstimates
              ? {
                  providerMetadata: {
                    mastra: {
                      tokenEstimate: { v: 0, source: 'client', key: 'client-image', tokens: 5_000 },
                    },
                  },
                }
              : {}),
          },
          {
            type: 'audio',
            data: 'storage://bucket/audio-ref',
            mimeType: 'audio/wav',
            ...(withClientEstimates
              ? {
                  providerMetadata: {
                    mastra: {
                      tokenEstimate: { v: 0, source: 'client', key: 'client-audio', tokens: 7_000 },
                    },
                  },
                }
              : {}),
          },
        ],
      });
      const createToolResultMessage = (result: unknown) =>
        createMessage({
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-1',
                toolName: 'cloud_multimodal_tool',
                result,
              },
            },
          ],
        });
      const withClientEstimates = createToolResultMessage(createCloudResult(true));
      const withoutClientEstimates = createToolResultMessage(createCloudResult(false));

      const estimatedTokens = counter.countMessage(withClientEstimates);
      const fallbackTokens = counter.countMessage(withoutClientEstimates);
      const estimate = withClientEstimates.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(estimatedTokens).toBeGreaterThanOrEqual(12_000);
      expect(estimatedTokens).toBeGreaterThan(fallbackTokens);
      expect(estimate.key).toContain('tool-result-multimodal-content');
      expect(estimate.tokens).toBeGreaterThanOrEqual(12_000);
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

  describe('tool approval (output-denied)', () => {
    // Regression: a declined approval persists as state 'output-denied', a tool-invocation
    // state the counter did not handle and used to throw on ("Unhandled tool-invocation
    // state ..."). It now counts the denial reason like a small tool result.
    const DEFAULT_DECLINE_REASON = 'Tool call was not approved by the user';

    const createDeniedMessage = (approval?: { id: string; approved: boolean; reason?: string }) =>
      createMessage({
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'output-denied',
              toolCallId: 'tool-1',
              toolName: 'findUserTool',
              args: { name: 'Dero Israel' },
              ...(approval ? { approval } : {}),
            },
          },
        ],
      });

    it('counts a declined approval by its approval reason instead of throwing', () => {
      const counter = new TokenCounter();
      const reason = 'Manager rejected this lookup';
      const message = createDeniedMessage({ id: 'tool-1', approved: false, reason });

      const tokens = counter.countMessage(message);
      const estimate = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(tokens).toBeGreaterThan(0);
      expect(estimate?.key).toContain('tool-result-denied');
      expect(estimate?.tokens).toBe(counter.countString(reason));
    });

    it('falls back to the default decline reason when approval.reason is absent', () => {
      const counter = new TokenCounter();
      const message = createDeniedMessage({ id: 'tool-1', approved: false });

      const tokens = counter.countMessage(message);
      const estimate = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;

      expect(tokens).toBeGreaterThan(0);
      expect(estimate?.key).toContain('tool-result-denied');
      expect(estimate?.tokens).toBe(counter.countString(DEFAULT_DECLINE_REASON));
    });

    it('does not throw when the output-denied invocation has no approval object at all', () => {
      const counter = new TokenCounter();
      const message = createDeniedMessage();

      expect(() => counter.countMessage(message)).not.toThrow();
      const estimate = message.content.parts[0].providerMetadata?.mastra?.tokenEstimate;
      expect(estimate?.key).toContain('tool-result-denied');
      expect(estimate?.tokens).toBe(counter.countString(DEFAULT_DECLINE_REASON));
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
