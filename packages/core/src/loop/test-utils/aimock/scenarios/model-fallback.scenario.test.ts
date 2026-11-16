import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import type { LLMock } from '@copilotkit/aimock';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Model-list fallback across engines (moved from durable-agent-model-fallback,
 * dynamic-model-fallback and per-model-fallback-settings).
 *
 * Each entry in `model: [...]` is a separate AIMock model id, so the request
 * journal shows exactly which model was called, in which order, and how often.
 * `errorProcessors: []` removes the default StreamErrorRetryProcessor so the
 * journal measures model-list retry/fallback alone. AIMock 429s carry
 * `Retry-After: 1`, so each model-level retry waits ~1s of real time.
 */

const FAILED = {
  error: { message: 'primary is down', type: 'server_error', code: 'bad_request' },
  status: 400,
} as const;

const RATE_LIMITED = {
  error: { message: 'rate limited', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
  status: 429,
} as const;

const SHORT_TIMEOUT_MS = 200;
const LONG_TIMEOUT_MS = 30_000;
const FIRST_CHUNK_DELAY_MS = 800;
const SLOW_FIRST_CHUNK = { streamingProfile: { ttft: FIRST_CHUNK_DELAY_MS } };

function modelList(
  llm: LLMock,
  entries: Array<{ id: string; maxRetries?: number; enabled?: boolean } & Record<string, unknown>>,
  api: 'responses' | 'chat' = 'responses',
) {
  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` });
  return () =>
    entries.map(({ id, ...rest }) => ({ id, model: api === 'chat' ? openai.chat(id) : openai(id), ...rest }));
}

function calledModels(requests: Array<{ body?: any }>) {
  return requests.map(r => r.body?.model);
}

describeForAllEngines('AIMock loop scenario: model fallback list', engine => {
  const getMock = useLoopScenarioAimock();

  it('falls back to the second model when the primary fails and persists only the fallback answer', async () => {
    const memory = new MockMemory();
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'Hello fallback',
      memory,
      threadId: 'fallback-thread',
      resourceId: 'fallback-user',
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 0 },
        { id: 'fallback-model', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'primary-model' }, FAILED);
        llm.on({ endpoint: 'chat', model: 'fallback-model' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Fallback response');
    expect(calledModels(requests)).toEqual(['primary-model', 'fallback-model']);
    expect(JSON.stringify(requests[1]!.body?.messages)).toContain('Hello fallback');

    const { messages } = await memory.recall({ threadId: 'fallback-thread', resourceId: 'fallback-user' });
    const assistantParts = messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts);
    expect(assistantParts.map(p => p.type)).toEqual(['text']);
    expect(assistantParts[0]).toMatchObject({ type: 'text', text: 'Fallback response' });
  });

  it('retries the primary model before falling back and stops once it succeeds', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 1 },
        { id: 'fallback-model', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'primary-model', sequenceIndex: 0 }, RATE_LIMITED);
        llm.on({ endpoint: 'chat', model: 'primary-model', sequenceIndex: 1 }, { content: 'Success after retry' });
        llm.on({ endpoint: 'chat', model: 'fallback-model' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Success after retry');
    expect(calledModels(requests)).toEqual(['primary-model', 'primary-model']);
  });

  it('falls back after exhausting the primary model retries', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 1 },
        { id: 'fallback-model', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'primary-model' }, RATE_LIMITED);
        llm.on({ endpoint: 'chat', model: 'fallback-model' }, { content: 'Fallback used' });
      },
    });

    expect(await output.text).toBe('Fallback used');
    expect(calledModels(requests)).toEqual(['primary-model', 'primary-model', 'fallback-model']);
  });

  it('never calls a disabled entry', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      model: modelList(getMock(), [
        { id: 'disabled-model', enabled: false },
        { id: 'enabled-model', enabled: true },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'disabled-model' }, { content: 'Disabled model response' });
        llm.on({ endpoint: 'chat', model: 'enabled-model' }, { content: 'Enabled model response' });
      },
    });

    expect(await output.text).toBe('Enabled model response');
    expect(calledModels(requests)).toEqual(['enabled-model']);
  });

  it('reports an error once every model in the list is exhausted', async () => {
    const errors: Array<Error | string> = [];
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      onError: ({ error }) => {
        errors.push(error);
      },
      model: modelList(getMock(), [
        { id: 'model-one', maxRetries: 0 },
        { id: 'model-two', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, FAILED);
      },
    });

    expect(await output.text).toBe('');
    expect(calledModels(requests)).toEqual(['model-one', 'model-two']);
    expect(errors).toHaveLength(1);
    expect(String(errors[0] instanceof Error ? errors[0].message : errors[0])).toContain('primary is down');
  });

  it('sends each entry its own headers after failover', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 0, headers: { 'x-entry': 'primary', 'x-primary-only': '1' } },
        { id: 'fallback-model', maxRetries: 0, headers: { 'x-entry': 'fallback' } },
      ]),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'primary-model' }, FAILED);
        llm.on({ endpoint: 'chat', model: 'fallback-model' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Fallback response');
    const [primary, fallback] = requests as Array<{ headers: Record<string, string> }>;
    expect(primary!.headers['x-entry']).toBe('primary');
    expect(fallback!.headers['x-entry']).toBe('fallback');
    expect(fallback!.headers).not.toHaveProperty('x-primary-only');
  });

  // The Responses journal body is normalized to model/messages/stream; the Chat
  // Completions body is journaled verbatim, so sampling settings are visible there.
  // Real OpenAI model ids: Mastra strips temperature/topP for ids its capability
  // registry does not list as temperature-capable (stream/aisdk/v5/execute.ts).
  it('sends each entry its own settings and provider options after failover without leaking the primary ones', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      model: modelList(
        getMock(),
        [
          {
            id: 'gpt-4o-mini',
            maxRetries: 0,
            modelSettings: { temperature: 0.1, topP: 0.5 },
            providerOptions: { openai: { user: 'primary-user' } },
          },
          { id: 'gpt-4o', maxRetries: 0, modelSettings: { temperature: 0.9 } },
        ],
        'chat',
      ),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'gpt-4o-mini' }, FAILED);
        llm.on({ endpoint: 'chat', model: 'gpt-4o' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Fallback response');
    const [primary, fallback] = requests as Array<{ body: Record<string, unknown> }>;
    expect(primary!.body).toMatchObject({ model: 'gpt-4o-mini', temperature: 0.1, top_p: 0.5, user: 'primary-user' });
    expect(fallback!.body).toMatchObject({ model: 'gpt-4o', temperature: 0.9 });
    expect(fallback!.body).not.toHaveProperty('top_p');
    expect(fallback!.body).not.toHaveProperty('user');
  });

  it('applies entry settings over call-time settings on every retry attempt', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      modelSettings: { temperature: 0.7, maxOutputTokens: 99 },
      providerOptions: { openai: { user: 'call-user' } },
      model: modelList(
        getMock(),
        [
          {
            id: 'gpt-4o-mini',
            maxRetries: 1,
            modelSettings: { temperature: 0.1 },
            providerOptions: { openai: { user: 'entry-user', store: false } },
          },
          { id: 'gpt-4o', maxRetries: 0 },
        ],
        'chat',
      ),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', model: 'gpt-4o-mini', sequenceIndex: 0 }, RATE_LIMITED);
        llm.on({ endpoint: 'chat', model: 'gpt-4o-mini', sequenceIndex: 1 }, { content: 'Success after retry' });
      },
    });

    expect(await output.text).toBe('Success after retry');
    expect(calledModels(requests)).toEqual(['gpt-4o-mini', 'gpt-4o-mini']);
    for (const request of requests as Array<{ body: Record<string, unknown> }>) {
      expect(request.body).toMatchObject({ temperature: 0.1, max_tokens: 99, user: 'entry-user', store: false });
    }
  });

  // The primary's first chunk arrives after FIRST_CHUNK_DELAY_MS. Whether that
  // trips a timeout shows which merged timeout fields the primary request ran with.
  it('keeps call-time timeout fields the entry does not override', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      modelSettings: { timeout: { firstChunkMs: SHORT_TIMEOUT_MS } },
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 0, modelSettings: { timeout: { stepMs: LONG_TIMEOUT_MS } } },
        { id: 'fallback-model', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ model: 'primary-model' }, { content: 'Primary response' }, SLOW_FIRST_CHUNK);
        llm.on({ model: 'fallback-model' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Fallback response');
    expect(calledModels(requests)).toEqual(['primary-model', 'fallback-model']);
  });

  it('lets an entry timeout field override the same call-time field', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      errorProcessors: [],
      llm: getMock(),
      prompt: 'hi',
      modelSettings: { timeout: { stepMs: SHORT_TIMEOUT_MS } },
      model: modelList(getMock(), [
        { id: 'primary-model', maxRetries: 0, modelSettings: { timeout: { stepMs: LONG_TIMEOUT_MS } } },
        { id: 'fallback-model', maxRetries: 0 },
      ]),
      fixtures: llm => {
        llm.on({ model: 'primary-model' }, { content: 'Primary response' }, SLOW_FIRST_CHUNK);
        llm.on({ model: 'fallback-model' }, { content: 'Fallback response' });
      },
    });

    expect(await output.text).toBe('Primary response');
    expect(calledModels(requests)).toEqual(['primary-model']);
  });
});
