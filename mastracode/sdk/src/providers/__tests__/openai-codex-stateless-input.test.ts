import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { wrapLanguageModel } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOpenAICodexOAuthFetch, createCodexMiddleware } from '../openai-codex.js';

const storage = {
  reload: vi.fn(),
  get: vi.fn(() => ({ type: 'oauth', access: 'oauth-token', expires: Date.now() + 60_000, accountId: 'acct-1' })),
  getApiKey: vi.fn(),
};

// A thread's second turn: the stored assistant message carries the ids the
// Responses API returned on the first turn.
const prompt: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
  {
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'Looking at the code',
        providerOptions: { openai: { itemId: 'rs_expired', reasoningEncryptedContent: 'enc-blob' } },
      },
      { type: 'text', text: 'Done.', providerOptions: { openai: { itemId: 'msg_expired' } } },
    ],
  },
  { role: 'user', content: [{ type: 'text', text: 'Thanks, now run the tests' }] },
];

describe('Codex stateless input', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends replayed reasoning and message items without server ids', async () => {
    let sentBody: any;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        sentBody = JSON.parse(await request.text());
        return new Response(JSON.stringify({ error: { message: 'stop here' } }), { status: 400 });
      }),
    );

    const openai = createOpenAI({
      apiKey: 'oauth-dummy-key',
      fetch: buildOpenAICodexOAuthFetch({ authStorage: storage as any }),
    });
    const model = wrapLanguageModel({
      model: openai.responses('gpt-5.5'),
      middleware: createCodexMiddleware('medium'),
    });

    await expect(model.doGenerate({ prompt })).rejects.toThrow();

    expect(sentBody.store).toBe(false);
    const reasoning = sentBody.input.find((item: any) => item.type === 'reasoning');
    expect(reasoning).toEqual({
      type: 'reasoning',
      encrypted_content: 'enc-blob',
      summary: [{ type: 'summary_text', text: 'Looking at the code' }],
    });
    const assistant = sentBody.input.find((item: any) => item.role === 'assistant');
    expect(assistant).not.toHaveProperty('id');
    expect(JSON.stringify(sentBody.input)).not.toMatch(/rs_expired|msg_expired/);
  });
});

describe('Codex fetch non-JSON bodies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams non-JSON bodies through byte-for-byte', async () => {
    let sent: Uint8Array | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        sent = new Uint8Array(await request.arrayBuffer());
        return new Response('{}', { status: 200 });
      }),
    );
    const bytes = new Uint8Array([0xff, 0x00, 0xfe, 0x7b]);

    await buildOpenAICodexOAuthFetch({ authStorage: storage as any })('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes,
    });

    expect(sent).toEqual(bytes);
  });
});
