import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DelegationCompleteContext } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Supervisor delegation through `agent.generate()`.
 *
 * `runLoopScenario` only streams, and a generating supervisor delegates through
 * the sub-agent's `generate()` instead of `stream()`, so this path needs its
 * own cases. Only the plain Agent exposes `generate()` with delegation, so this
 * file runs on the normal engine.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const isWorker = (req: ChatCompletionRequest) => !isSupervisor(req);

function makeWorker(mock: LLMock, tools?: Record<string, ReturnType<typeof createTool>>) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Does delegated work',
    instructions: 'You do delegated work.',
    model: openai(SCENARIO_MODEL_ID),
    ...(tools ? { tools } : {}),
  });
}

async function generateWithWorker(
  mock: LLMock,
  worker: Agent,
  onDelegationComplete: (ctx: DelegationCompleteContext) => unknown,
) {
  const { agent } = await createSharedAgent(mock, {
    agents: { worker },
    memory: new MockMemory(),
    errorProcessors: [],
  });
  const result = await agent.generate('Delegate the task.', {
    maxSteps: 3,
    delegation: { onDelegationComplete: onDelegationComplete as any },
  });
  const followUp = mock
    .getRequests()
    .map(r => r.body as ChatCompletionRequest)
    .find(req => isSupervisor(req) && lastIsToolResult(req));
  expect(followUp, 'supervisor made a follow-up request with the delegation result').not.toBeUndefined();
  const toolMessage = followUp!.messages.at(-1)!;
  const seenBySupervisor =
    typeof toolMessage.content === 'string' ? toolMessage.content : JSON.stringify(toolMessage.content);
  return { result, seenBySupervisor };
}

function delegateFixture(mock: LLMock) {
  mock.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'do the task' } }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
    { content: 'Supervisor done.' },
  );
}

describe('AIMock scenario: supervisor delegation via generate()', () => {
  const getMock = useLoopScenarioAimock();

  it('reports the sub-agent finish reason and tool results to onDelegationComplete', async () => {
    const mock = getMock();
    let complete: DelegationCompleteContext | undefined;
    const getWeather = createTool({
      id: 'get-weather',
      description: 'Get the weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temperature: 20, city }),
    });
    delegateFixture(mock);
    mock.on(
      { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
      { toolCalls: [{ id: 'sub_call_1', name: 'get-weather', arguments: { city: 'Paris' } }] },
    );
    mock.on(
      { endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) },
      { content: 'It is 20 degrees in Paris.' },
    );

    const { result, seenBySupervisor } = await generateWithWorker(
      mock,
      makeWorker(mock, { 'get-weather': getWeather }),
      ctx => {
        complete = ctx;
      },
    );

    expect(result.text).toBe('Supervisor done.');
    expect(complete!.result.text).toBe('It is 20 degrees in Paris.');
    expect(complete!.result.finishReason).toBe('stop');
    expect(complete!.result.subAgentToolResults).toEqual([
      expect.objectContaining({
        toolName: 'get-weather',
        args: { city: 'Paris' },
        result: { temperature: 20, city: 'Paris' },
      }),
    ]);
    expect(seenBySupervisor).toContain('It is 20 degrees in Paris.');
  });

  it('reports sub-agent client tool calls (no execute) as pending and tells the supervisor', async () => {
    const mock = getMock();
    let complete: DelegationCompleteContext | undefined;
    const addToCart = createTool({
      id: 'add-to-cart',
      description: 'Add a product to the cart in the browser',
      inputSchema: z.object({ productId: z.string() }),
    });
    delegateFixture(mock);
    mock.on(
      { endpoint: 'chat', predicate: isWorker },
      { toolCalls: [{ id: 'sub-call-1', name: 'add-to-cart', arguments: { productId: 'sku-1' } }] },
    );

    const { seenBySupervisor } = await generateWithWorker(mock, makeWorker(mock, { 'add-to-cart': addToCart }), ctx => {
      complete = ctx;
    });

    expect(complete!.result.finishReason).toBe('tool-calls');
    expect(complete!.result.subAgentToolResults).toEqual([]);
    expect(complete!.result.subAgentPendingToolCalls).toEqual([
      { toolName: 'add-to-cart', toolCallId: 'sub-call-1', args: { productId: 'sku-1' } },
    ]);
    expect(seenBySupervisor).toContain(
      'it called tools that have no server-side execute and were never run: add-to-cart({"productId":"sku-1"})',
    );
  });

  it('does not report a sub-agent tool that threw as pending', async () => {
    const mock = getMock();
    let complete: DelegationCompleteContext | undefined;
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        throw new Error('lookup failed');
      },
    });
    delegateFixture(mock);
    mock.on(
      { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
      { toolCalls: [{ id: 'sub_call_1', name: 'lookup', arguments: { q: 'x' } }] },
    );
    mock.on(
      { endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) },
      { content: 'Recovered answer' },
    );

    const { seenBySupervisor } = await generateWithWorker(mock, makeWorker(mock, { lookup }), ctx => {
      complete = ctx;
    });

    expect(complete!.result.finishReason).toBe('stop');
    expect(complete!.result.subAgentPendingToolCalls).toBeUndefined();
    expect(seenBySupervisor).toContain('Recovered answer');
    expect(seenBySupervisor).not.toContain('were never run');
  });

  it('sends resultText for a failed delegation to the supervisor as a tool error', async () => {
    const mock = getMock();
    const resultText = 'The sub-agent failed in a recoverable way.';
    const completes: DelegationCompleteContext[] = [];
    delegateFixture(mock);
    mock.on(
      { endpoint: 'chat', predicate: isWorker },
      { error: { message: 'WORKER_PROVIDER_BOOM', type: 'invalid_request_error', code: 'bad_request' }, status: 400 },
    );
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const worker = new Agent({
      id: 'worker',
      name: 'worker',
      description: 'Fails',
      instructions: 'You fail.',
      model: openai(SCENARIO_MODEL_ID),
      maxRetries: 0,
    });

    const { result, seenBySupervisor } = await generateWithWorker(mock, worker, ctx => {
      completes.push(ctx);
      return { resultText };
    });

    expect(result.text).toBe('Supervisor done.');
    expect(completes).toHaveLength(1);
    expect(completes[0]!.success).toBe(false);
    expect(completes[0]!.error?.message).toContain('WORKER_PROVIDER_BOOM');
    expect(seenBySupervisor).toContain(resultText);
    expect(seenBySupervisor).not.toContain('Failed agent tool execution');
  });

  // Regression #14820 on the generate branch: the delegated generate() must get the parent abortSignal.
  it('aborts the delegated sub-agent when the supervisor generate() is aborted', async () => {
    const mock = getMock();
    const controller = new AbortController();
    let signalBeforeAbort: boolean | undefined;
    let signalAfterAbort: boolean | undefined;
    const probe = createTool({
      id: 'probe',
      description: 'Aborts the supervisor and records what the sub-agent signal saw.',
      inputSchema: z.object({}),
      execute: async (_input, ctx) => {
        signalBeforeAbort = ctx?.abortSignal?.aborted;
        controller.abort();
        signalAfterAbort = ctx?.abortSignal?.aborted;
        return { ok: true };
      },
    });
    delegateFixture(mock);
    mock.on(
      { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
      { toolCalls: [{ id: 'call_probe', name: 'probe', arguments: {} }] },
    );
    mock.on({ endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) }, { content: 'Worked.' });
    const { agent } = await createSharedAgent(mock, {
      agents: { worker: makeWorker(mock, { probe }) },
      memory: new MockMemory(),
      errorProcessors: [],
    });

    await agent.generate('go', { maxSteps: 5, abortSignal: controller.signal }).catch(() => undefined);

    expect(signalBeforeAbort).toBe(false);
    expect(signalAfterAbort).toBe(true);
    // The aborted sub-agent never asks its model to continue after the probe.
    const workerRequests = mock.getRequests().filter(r => isWorker(r.body as ChatCompletionRequest));
    expect(workerRequests).toHaveLength(1);
  });
});
