import o200k_base from 'js-tiktoken/ranks/o200k_base';
import { describe, it, expect } from 'vitest';

import { TokenCounter } from '../token-counter';

let sharedCustomCounter: TokenCounter | undefined;

function getSharedCustomCounter() {
  if (!sharedCustomCounter) {
    sharedCustomCounter = new TokenCounter(o200k_base);
  }

  return sharedCustomCounter;
}

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
  describe('shared default encoder', () => {
    it('two default TokenCounter instances share the same encoder reference', () => {
      const a = new TokenCounter();
      const b = new TokenCounter();

      const encoderA = (a as any).encoder;
      const encoderB = (b as any).encoder;

      expect(encoderA).toBe(encoderB);
    });

    it('default encoder produces correct token counts', () => {
      const counter = new TokenCounter();
      const tokens = counter.countString('hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('two default instances produce identical counts for the same input', () => {
      const a = new TokenCounter();
      const b = new TokenCounter();
      const text = 'The quick brown fox jumps over the lazy dog';

      expect(a.countString(text)).toBe(b.countString(text));
    });
  });

  describe('custom encoding', () => {
    it('constructor with explicit encoding creates a separate encoder instance', () => {
      const defaultCounter = new TokenCounter();
      const customCounter = getSharedCustomCounter();

      const encoderDefault = (defaultCounter as any).encoder;
      const encoderCustom = (customCounter as any).encoder;

      expect(encoderCustom).not.toBe(encoderDefault);
    });

    it('custom encoding still produces valid token counts', () => {
      const counter = getSharedCustomCounter();

      const tokens = counter.countString('hello world');
      expect(tokens).toBeGreaterThan(0);
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

    it('counts data-uri image parts with deterministic fallback sizing', () => {
      const counter = new TokenCounter(undefined, { model: 'openai/gpt-4o' });
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
      const counter = new TokenCounter(undefined, { model: 'openai/gpt-4o' });
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

    it('reuses cached image estimates without re-encoding text payloads', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'image', image: new URL('https://example.com/cached.png') }],
      });

      const encoder = (counter as any).encoder;
      const originalEncode = encoder.encode.bind(encoder);
      let encodeCalls = 0;

      try {
        encoder.encode = (...args: any[]) => {
          encodeCalls += 1;
          return originalEncode(...args);
        };

        const first = counter.countMessage(message);
        const second = counter.countMessage(message);

        expect(second).toBe(first);
        expect(encodeCalls).toBe(2);
      } finally {
        encoder.encode = originalEncode;
      }
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

      const defaultCounter = new TokenCounter(undefined, { model: 'openai/gpt-4o' });
      const miniCounter = new TokenCounter(undefined, { model: 'openai/gpt-4o-mini' });

      const defaultTokens = defaultCounter.countMessage(message);
      const defaultCachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      const miniTokens = miniCounter.countMessage(message);
      const miniCachedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate;

      expect(defaultTokens).toBeGreaterThan(765);
      expect(defaultCachedEntry.tokens).toBe(765);
      expect(miniTokens).toBeGreaterThan(defaultTokens);
      expect(miniCachedEntry.tokens).toBe(25501);
      expect(miniCachedEntry.key).not.toBe(defaultCachedEntry.key);
    });
  });

  describe('token estimate cache', () => {
    it('writes and reuses part-level token estimates on text parts without re-encoding payload on cache hit', () => {
      const counter = new TokenCounter();
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Hello from cached text part' }],
      });

      const encoder = (counter as any).encoder;
      const originalEncode = encoder.encode.bind(encoder);
      let encodeCalls = 0;

      try {
        encoder.encode = (...args: any[]) => {
          encodeCalls += 1;
          return originalEncode(...args);
        };

        const first = counter.countMessage(message);
        expect(first).toBeGreaterThan(0);
        expect(message.content.parts[0].providerMetadata?.mastra?.tokenEstimate).toBeTruthy();

        const callsAfterFirst = encodeCalls;
        const second = counter.countMessage(message);
        const callsAfterSecond = encodeCalls;

        expect(second).toBe(first);
        expect(callsAfterSecond - callsAfterFirst).toBe(1);

        const reloaded = {
          ...JSON.parse(JSON.stringify(message)),
          createdAt: new Date(message.createdAt),
        };

        const third = counter.countMessage(reloaded as any);
        const callsAfterThird = encodeCalls;

        expect(third).toBe(first);
        expect(callsAfterThird - callsAfterSecond).toBe(1);
        expect(reloaded.content.parts[0].providerMetadata?.mastra?.tokenEstimate).toBeTruthy();
      } finally {
        encoder.encode = originalEncode;
      }
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

    it('scopes cache source by encoding identity', () => {
      const message = createMessage({
        format: 2,
        parts: [{ type: 'text', text: 'Same payload, different encoding identity' }],
      });

      const defaultCounter = new TokenCounter();
      defaultCounter.countMessage(message);
      const defaultEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;

      const customCounter = getSharedCustomCounter();
      customCounter.countMessage(message);

      const refreshedEntry = message.content.parts[0].providerMetadata.mastra.tokenEstimate as any;
      expect(refreshedEntry.source).not.toBe(defaultEntry.source);
      expect(refreshedEntry.source).toContain('custom:');
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
  });

  describe('countObservations', () => {
    it('delegates to countString', () => {
      const counter = new TokenCounter();
      const text = 'Some observation text';
      expect(counter.countObservations(text)).toBe(counter.countString(text));
    });
  });
});
