/**
 * Provider-history-compat acceptance suite.
 *
 * `ProviderHistoryCompat` is enabled on every agent by default. Its unit tests prove each
 * rule rewrites the prompt the way we intend; this suite proves the *provider* accepts the
 * result. Each scenario is the real user story the rule exists for — a thread that was
 * started on one provider and continued on another — driven through a real `Agent`,
 * `MockMemory`, and a real provider, then replayed with `exactMatch` so any drift in the
 * outbound body is a failure rather than a fuzzy match.
 *
 * Recordings are split per scenario so a missing recording is a visible skip.
 *
 *   LLM_TEST_MODE=record OPENAI_API_KEY=... ANTHROPIC_API_KEY=... GOOGLE_GENERATIVE_AI_API_KEY=... \
 *     pnpm vitest run provider-history-compat.e2e --project e2e:packages/core
 *
 * Identity-linked Anthropic keys additionally need ANTHROPIC_WORKSPACE_ID.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai-v5';
import { defaultNameGenerator, getLLMRecordingsDir, getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, hasRealApiKey, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list';
import type { OpenAICompatibleConfig } from '../llm/model/shared.types';
import { MockMemory } from '../memory/mock';
import { createTool } from '../tools';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic', 'google']);

type ProviderKey = 'openai' | 'anthropic' | 'google';

const HOSTS: Record<ProviderKey, string> = {
  openai: 'api.openai.com',
  anthropic: 'api.anthropic.com',
  google: 'generativelanguage.googleapis.com',
};

const MODELS: Record<ProviderKey, OpenAICompatibleConfig> = {
  openai: { id: 'openai/gpt-4o-mini' },
  anthropic: {
    id: 'anthropic/claude-haiku-4-5',
    headers: process.env.ANTHROPIC_WORKSPACE_ID
      ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID }
      : undefined,
  },
  google: { id: 'google/gemini-3.6-flash' },
};

/** Flatten a provider request body into the list of content-block types it carries, in order. */
function wireBlockTypes(provider: ProviderKey, body: any): string[] {
  switch (provider) {
    case 'openai':
      return (body.input ?? []).flatMap((item: any) =>
        item.type && item.type !== 'message' ? [item.type] : [`message:${item.role}`],
      );
    case 'anthropic':
      return body.messages.flatMap((m: any) =>
        typeof m.content === 'string' ? [`${m.role}:text`] : m.content.map((p: any) => `${m.role}:${p.type}`),
      );
    case 'google':
      return body.contents.flatMap((c: any) =>
        c.parts.map((p: any) => {
          const kind = p.functionCall
            ? 'functionCall'
            : p.functionResponse
              ? 'functionResponse'
              : p.thought
                ? 'thought'
                : 'text';
          return `${c.role}:${kind}`;
        }),
      );
  }
}

type Sent = { provider: ProviderKey; body: any; status: number };

function scenario(
  name: string,
  providers: ProviderKey[],
  run: (ctx: { sent: Sent[]; memory: MockMemory; thread: { thread: string; resource: string } }) => Promise<void>,
) {
  const recordingsDir = join(getLLMRecordingsDir(__filename), defaultNameGenerator(__filename));
  const recordingName = `compat-${name}`;
  const hasRecording = existsSync(join(recordingsDir, `${recordingName}.json`));
  const haveKeys = providers.every(hasRealApiKey);
  const canRun = MODE === 'replay' || MODE === 'auto' ? hasRecording || haveKeys : haveKeys;

  describe.skipIf(!canRun)(`provider history compat › ${name}`, () => {
    let mock: ReturnType<typeof createGatewayMock>;
    const sent: Sent[] = [];
    let realFetch: typeof globalThis.fetch;

    beforeAll(async () => {
      mock = createGatewayMock({ name: recordingName, recordingsDir, exactMatch: true });
      await mock.start();
    });
    afterAll(() => mock.saveAndStop());

    beforeEach(() => {
      realFetch = globalThis.fetch;
      sent.length = 0;
      globalThis.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const provider = (Object.keys(HOSTS) as ProviderKey[]).find(p => url.includes(HOSTS[p]));
        const res = await realFetch(input, init);
        if (provider && init?.body && typeof init.body === 'string') {
          sent.push({ provider, body: JSON.parse(init.body), status: res.status });
        }
        return res;
      };
    });
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('is accepted by the destination provider', async () => {
      await run({
        sent,
        memory: new MockMemory(),
        thread: { thread: `thread-${name}`, resource: `resource-${name}` },
      });
    });
  });
}

const agentOn = (
  provider: ProviderKey,
  memory: MockMemory,
  extra: Partial<ConstructorParameters<typeof Agent>[0]> = {},
) =>
  new Agent({
    id: `compat-${provider}`,
    name: `compat-${provider}`,
    instructions: 'Answer in at most ten words.',
    model: MODELS[provider],
    memory,
    maxProcessorRetries: 1,
    ...extra,
  });

// ---------------------------------------------------------------------------
// strip-foreign-provider-executed-tools
// ---------------------------------------------------------------------------

for (const destination of ['anthropic', 'google'] as const) {
  scenario(`openai-web-search-then-${destination}`, ['openai', destination], async ({ sent, memory, thread }) => {
    // Turn 1: OpenAI runs its hosted web_search tool. The call/result pair is provider-owned.
    const first = await agentOn('openai', memory, { tools: { web_search: openai.tools.webSearch({}) } }).generate(
      'Use the web_search tool to find who created TypeScript, then answer in one sentence.',
      { memory: thread },
    );
    expect(first.toolCalls.some(tc => tc.payload.toolName === 'web_search' && tc.payload.providerExecuted)).toBe(true);

    // Turn 2: same thread on another provider. It cannot resolve OpenAI's tool ids, so the
    // outbound prompt must not carry the hosted-tool pair — but the surrounding text must survive.
    const second = await agentOn(destination, memory).generate('Say the word "ready" and nothing else.', {
      memory: thread,
    });
    expect(second.text.toLowerCase()).toContain('ready');

    const last = sent.at(-1)!;
    expect(last.provider).toBe(destination);
    expect(last.status).toBe(200);
    const types = wireBlockTypes(destination, last.body);
    expect(types.some(t => /tool|function/i.test(t))).toBe(false);
    expect(types.filter(t => t.startsWith('assistant') || t.startsWith('model')).length).toBeGreaterThan(0);
  });
}

// ---------------------------------------------------------------------------
// anthropic-strip-foreign-reasoning-content (+ native round-trip control)
// ---------------------------------------------------------------------------

scenario('google-thinking-then-anthropic', ['google', 'anthropic'], async ({ sent, memory, thread }) => {
  // Turn 1: Gemini thinks; reasoning parts carry google provider metadata (thought signatures).
  const first = await agentOn('google', memory).generate('What is 17 * 23? Think it through, then answer.', {
    memory: thread,
    providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
  });
  expect(first.reasoningText?.length ?? 0).toBeGreaterThan(0);

  // Turn 2: Anthropic rejects foreign reasoning blocks, so they must be stripped on the wire.
  const second = await agentOn('anthropic', memory).generate('Say the word "ready" and nothing else.', {
    memory: thread,
  });
  expect(second.text.toLowerCase()).toContain('ready');

  const last = sent.at(-1)!;
  expect(last.provider).toBe('anthropic');
  expect(last.status).toBe(200);
  const types = wireBlockTypes('anthropic', last.body);
  expect(types).not.toContain('assistant:thinking');
  expect(types).toContain('assistant:text');
});

scenario('anthropic-thinking-roundtrip', ['anthropic'], async ({ sent, memory, thread }) => {
  const thinking = { anthropic: { thinking: { type: 'enabled', budgetTokens: 1024 } } };

  // Turn 1: native Anthropic thinking with a signature.
  const first = await agentOn('anthropic', memory).generate('What is 17 * 23? Think it through, then answer.', {
    memory: thread,
    providerOptions: thinking,
  });
  expect(first.reasoningText?.length ?? 0).toBeGreaterThan(0);

  // Turn 2: native thinking must NOT be stripped — Anthropic verifies the signature on replay.
  const second = await agentOn('anthropic', memory).generate('Say the word "ready" and nothing else.', {
    memory: thread,
    providerOptions: thinking,
  });
  expect(second.text.toLowerCase()).toContain('ready');

  const last = sent.at(-1)!;
  expect(last.status).toBe(200);
  const types = wireBlockTypes('anthropic', last.body);
  expect(types).toContain('assistant:thinking');
  const thinkingBlock = last.body.messages.flatMap((m: any) => m.content).find((p: any) => p.type === 'thinking');
  expect(typeof thinkingBlock.signature).toBe('string');
  expect(thinkingBlock.signature.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// anthropic-tool-id-format (reactive: 400 → rewrite persisted ids → retry)
// ---------------------------------------------------------------------------

scenario('foreign-tool-id-then-anthropic', ['anthropic'], async ({ sent, memory, thread }) => {
  const badId = 'call:legacy.id/123';
  const lookup = createTool({
    id: 'lookup',
    description: 'Look something up.',
    inputSchema: z.object({ topic: z.string() }),
    execute: async ({ topic }) => ({ details: `Info about ${topic}` }),
  });

  // Seed a thread with a tool call id in a format Anthropic rejects (`^[a-zA-Z0-9_-]+$`).
  await memory.saveThread({ thread: { id: thread.thread, resourceId: thread.resource, title: 't' } as any });
  const seeded: MastraDBMessage[] = [
    {
      id: 'm1',
      threadId: thread.thread,
      resourceId: thread.resource,
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'Look up TypeScript.' }] },
    },
    {
      id: 'm2',
      threadId: thread.thread,
      resourceId: thread.resource,
      role: 'assistant',
      createdAt: new Date('2026-01-01T00:00:01Z'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: badId,
              toolName: 'lookup',
              args: { topic: 'TypeScript' },
              result: { details: 'Info about TypeScript' },
            },
          },
          { type: 'text', text: 'TypeScript is a typed superset of JavaScript.' },
        ],
      },
    },
  ];
  await memory.saveMessages({ messages: seeded });

  const result = await agentOn('anthropic', memory, { tools: { lookup } }).generate(
    'Say the word "ready" and nothing else.',
    { memory: thread },
  );
  expect(result.text.toLowerCase()).toContain('ready');

  // First attempt is rejected, the rule rewrites the id, the retry succeeds.
  expect(sent.map(s => s.status)).toEqual([400, 200]);
  const retryIds = sent[1]!.body.messages
    .flatMap((m: any) => (typeof m.content === 'string' ? [] : m.content))
    .filter((p: any) => p.type === 'tool_use' || p.type === 'tool_result')
    .map((p: any) => p.id ?? p.tool_use_id);
  expect(retryIds.length).toBe(2);
  for (const id of retryIds) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
});
