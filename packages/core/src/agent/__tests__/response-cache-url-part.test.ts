import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MastraServerCache } from '../../cache';
import { buildResponseCacheKey, ResponseCache } from '../../processors/processors/response-cache';
import { Agent } from '../agent';

class RecordingServerCache extends MastraServerCache {
  readonly store = new Map<string, unknown>();
  sets = 0;

  constructor() {
    super({ name: 'RecordingServerCache' });
  }

  async get(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.sets++;
    this.store.set(key, value);
  }

  async listLength(): Promise<number> {
    return 0;
  }

  async listPush(): Promise<void> {}

  async listFromTo(): Promise<unknown[]> {
    return [];
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async increment(): Promise<number> {
    return 0;
  }
}

async function waitForSets(cache: RecordingServerCache, expected: number) {
  const deadline = Date.now() + 1_000;
  while (cache.sets < expected) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${expected} cache writes (saw ${cache.sets})`);
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

/**
 * Declares every https URL as natively supported so the prompt keeps
 * `data: URL` file parts instead of downloading them into `Uint8Array`.
 * That is the shape real providers with URL support (e.g. Anthropic PDFs,
 * OpenAI image URLs) receive.
 */
function createUrlCapableModel(responseText: string) {
  return new MockLanguageModelV2({
    modelId: 'url-capable-model',
    supportedUrls: { '*': [/^https?:\/\/.*$/] },
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'url-capable-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
    }),
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: responseText }],
    }),
  });
}

function urlPrompt(url: string) {
  return [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'Describe this image' },
        { type: 'file' as const, mediaType: 'image/png', filename: undefined, data: new URL(url) },
      ],
    },
  ];
}

describe('buildResponseCacheKey with non-plain prompt values', () => {
  const base = {
    agentId: 'url-agent',
    model: { provider: 'test', modelId: 'url-capable-model', specVersion: 'v2' },
    stepNumber: 0,
  };

  it('distinguishes prompts whose only difference is a URL file part', () => {
    const cat = buildResponseCacheKey({ ...base, prompt: urlPrompt('https://example.com/cat.png') as never });
    const dog = buildResponseCacheKey({ ...base, prompt: urlPrompt('https://example.com/dog.png') as never });

    expect(cat).not.toBe(dog);
  });

  it('distinguishes prompts whose only difference is binary file data', () => {
    const bytesPrompt = (bytes: number[]) => [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Describe this image' },
          { type: 'file' as const, mediaType: 'image/png', filename: undefined, data: new Uint8Array(bytes) },
        ],
      },
    ];

    const a = buildResponseCacheKey({ ...base, prompt: bytesPrompt([1, 2, 3]) as never });
    const b = buildResponseCacheKey({ ...base, prompt: bytesPrompt([4, 5, 6]) as never });

    expect(a).not.toBe(b);
  });

  it('stays deterministic for the same URL file part', () => {
    const first = buildResponseCacheKey({ ...base, prompt: urlPrompt('https://example.com/cat.png') as never });
    const second = buildResponseCacheKey({ ...base, prompt: urlPrompt('https://example.com/cat.png') as never });

    expect(first).toBe(second);
  });

  it('treats an equal Uint8Array copy as the same key', () => {
    const bytesPrompt = (bytes: Uint8Array) => [
      {
        role: 'user' as const,
        content: [{ type: 'file' as const, mediaType: 'image/png', filename: undefined, data: bytes }],
      },
    ];

    const first = buildResponseCacheKey({ ...base, prompt: bytesPrompt(new Uint8Array([1, 2, 3])) as never });
    const second = buildResponseCacheKey({ ...base, prompt: bytesPrompt(new Uint8Array([1, 2, 3])) as never });

    expect(first).toBe(second);
  });

  it('does not expand binary file data byte-by-byte', () => {
    // A 1 MiB image expanded into one JSON property per byte took ~680 ms and
    // ~11 MiB of intermediate JSON, synchronously, before the model was called.
    const prompt = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Describe this image' },
          {
            type: 'file' as const,
            mediaType: 'image/png',
            filename: undefined,
            data: new Uint8Array(1024 * 1024).fill(7),
          },
        ],
      },
    ];

    const start = performance.now();
    buildResponseCacheKey({ ...base, prompt: prompt as never });
    const elapsed = performance.now() - start;

    // Generous bound: the byte-walk is ~2 orders of magnitude slower, so this
    // catches a regression without being flaky on a loaded CI worker.
    expect(elapsed).toBeLessThan(150);
  });

  it('keeps Date values distinguishable', () => {
    const datePrompt = (iso: string) => [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hi' }],
        providerOptions: { custom: { at: new Date(iso) } },
      },
    ];

    const a = buildResponseCacheKey({ ...base, prompt: datePrompt('2020-01-01T00:00:00.000Z') as never });
    const b = buildResponseCacheKey({ ...base, prompt: datePrompt('2021-01-01T00:00:00.000Z') as never });

    expect(a).not.toBe(b);
  });

  it('still strips providerOptions.mastra from nested plain objects', () => {
    const withMastraMeta = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: 'hi',
            providerOptions: { mastra: { createdAt: '2020-01-01T00:00:00.000Z' }, openai: { cacheControl: 'x' } },
          },
        ],
      },
    ];
    const withoutMastraMeta = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hi', providerOptions: { openai: { cacheControl: 'x' } } }],
      },
    ];

    expect(buildResponseCacheKey({ ...base, prompt: withMastraMeta as never })).toBe(
      buildResponseCacheKey({ ...base, prompt: withoutMastraMeta as never }),
    );
  });
});

describe('ResponseCache with URL file parts (integration via Agent)', () => {
  it('does not serve one image URL response for a different image URL', async () => {
    const cache = new RecordingServerCache();
    const model = createUrlCapableModel('A cat on a mat');
    const agent = new Agent({
      id: 'url-agent',
      name: 'URL Agent',
      instructions: 'You describe images',
      model,
      inputProcessors: [new ResponseCache({ cache, agentId: 'url-agent' })],
    });

    await agent.generate([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'image', image: new URL('https://example.com/cat.png'), mimeType: 'image/png' },
        ],
      },
    ]);
    await waitForSets(cache, 1);
    expect(model.doGenerateCalls).toHaveLength(1);

    // Same text, different image URL: this must reach the model, not replay
    // the cat answer.
    await agent.generate([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'image', image: new URL('https://example.com/dog.png'), mimeType: 'image/png' },
        ],
      },
    ]);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(cache.store.size).toBe(2);
  });
});
