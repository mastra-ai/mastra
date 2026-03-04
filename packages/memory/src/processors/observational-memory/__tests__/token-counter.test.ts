import { describe, it, expect } from 'vitest';

import { TokenCounter } from '../token-counter';

function createMessage(content: any) {
  return {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content,
  } as any;
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
      const o200k_base = require('js-tiktoken/ranks/o200k_base');
      const customCounter = new TokenCounter(o200k_base);

      const encoderDefault = (defaultCounter as any).encoder;
      const encoderCustom = (customCounter as any).encoder;

      expect(encoderCustom).not.toBe(encoderDefault);
    });

    it('custom encoding still produces valid token counts', () => {
      const o200k_base = require('js-tiktoken/ranks/o200k_base');
      const counter = new TokenCounter(o200k_base);

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
      const firstEstimateMap = message.content.parts[0].providerMetadata.mastra.tokenEstimate;
      const firstEntry = Object.values(firstEstimateMap)[0] as any;

      message.content.parts[0].text = 'Mutated text payload with different size and tokens';
      const recounted = counter.countMessage(message);
      const secondEstimateMap = message.content.parts[0].providerMetadata.mastra.tokenEstimate;
      const secondEntry = Object.values(secondEstimateMap).find((entry: any) => entry?.key !== firstEntry.key) as any;

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
      const estimateMap = message.content.parts[0].providerMetadata.mastra.tokenEstimate;
      const [entryKey, entry] = Object.entries(estimateMap)[0] as [string, any];

      message.content.parts[0].providerMetadata.mastra.tokenEstimate = {
        ...estimateMap,
        [entryKey]: {
          ...entry,
          v: entry.v + 1,
        },
      };
      counter.countMessage(message);
      const versionRefreshed = message.content.parts[0].providerMetadata.mastra.tokenEstimate[entryKey];
      expect(versionRefreshed.v).toBe(entry.v);

      message.content.parts[0].providerMetadata.mastra.tokenEstimate = {
        ...message.content.parts[0].providerMetadata.mastra.tokenEstimate,
        [entryKey]: {
          ...versionRefreshed,
          source: `${versionRefreshed.source}-mismatch`,
        },
      };
      counter.countMessage(message);
      const sourceRefreshed = message.content.parts[0].providerMetadata.mastra.tokenEstimate[entryKey];
      expect(sourceRefreshed.source).toBe(entry.source);
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
  });

  describe('countObservations', () => {
    it('delegates to countString', () => {
      const counter = new TokenCounter();
      const text = 'Some observation text';
      expect(counter.countObservations(text)).toBe(counter.countString(text));
    });
  });
});
