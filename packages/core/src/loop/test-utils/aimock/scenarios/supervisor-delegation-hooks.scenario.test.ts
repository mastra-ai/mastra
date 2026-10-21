import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DelegationCompleteContext, DelegationStartContext, IterationCompleteContext } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Supervisor delegation hooks on the streaming path.
 *
 * A supervisor delegates to a sub-agent through the `agent-<key>` tool. The
 * delegation hooks must fire only for sub-agent calls, report what the
 * sub-agent actually did (text, finish reason, tool results, client tool calls
 * it could not run, provider failures), and `onDelegationComplete` can replace
 * the text the supervisor model sees for the delegation.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const isWorker = (req: ChatCompletionRequest) => !isSupervisor(req);

const DELEGATE = { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'do the task' } }] };

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

function supervisorRequests(mock: LLMock) {
  return mock.getRequests().filter(r => isSupervisor(r.body as ChatCompletionRequest));
}

function workerRequests(mock: LLMock) {
  return mock.getRequests().filter(r => isWorker(r.body as ChatCompletionRequest));
}

/** The delegation tool result the supervisor model received on its follow-up turn. */
function delegationResultSeenBySupervisor(mock: LLMock): string {
  const followUp = supervisorRequests(mock).find(r => lastIsToolResult(r.body as ChatCompletionRequest));
  expect(followUp, 'supervisor made a follow-up request with the delegation result').not.toBeUndefined();
  const toolMessage = (followUp!.body as ChatCompletionRequest).messages.at(-1)!;
  return typeof toolMessage.content === 'string' ? toolMessage.content : JSON.stringify(toolMessage.content);
}

describeForAllEngines('AIMock loop scenario: supervisor delegation hooks', engine => {
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
  const getMock = useLoopScenarioAimock();

  // Inngest's agentic loop has no onIterationComplete step yet.
  itFailsOnInngest('does not fire delegation hooks for a regular tool call', async () => {
    const mock = getMock();
    const starts: DelegationStartContext[] = [];
    const completes: DelegationCompleteContext[] = [];
    const iterations: number[] = [];

    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ q }) => ({ answer: `found ${q}` }),
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Look up dolphins.',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      errorProcessors: [],
      delegation: {
        onDelegationStart: (ctx: DelegationStartContext) => {
          starts.push(ctx);
          return { proceed: true };
        },
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          completes.push(ctx);
        },
      },
      onIterationComplete: (ctx: IterationCompleteContext) => {
        iterations.push(ctx.iteration);
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { q: 'dolphins' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Dolphins are mammals.' });
      },
    });

    expect(await output.text).toBe('Dolphins are mammals.');
    expect(starts).toEqual([]);
    expect(completes).toEqual([]);
    expect(iterations).toEqual([1, 2]);
  });

  it('reports the sub-agent text, finish reason and tool results to the hooks in order', async () => {
    const mock = getMock();
    const events: string[] = [];
    let start: DelegationStartContext | undefined;
    let complete: DelegationCompleteContext | undefined;

    const getWeather = createTool({
      id: 'get-weather',
      description: 'Get the weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temperature: 20, city }),
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Check the weather in Paris.',
      agents: { worker: makeWorker(mock, { 'get-weather': getWeather }) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationStart: (ctx: DelegationStartContext) => {
          events.push('start');
          start = ctx;
          return { proceed: true };
        },
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          events.push('complete');
          complete = ctx;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'sub_call_1', name: 'get-weather', arguments: { city: 'Paris' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) },
          { content: 'It is 20 degrees in Paris.' },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Paris is mild today.' },
        );
      },
    });

    expect(await output.text).toBe('Paris is mild today.');
    expect(events).toEqual(['start', 'complete']);
    expect(start).toMatchObject({ primitiveId: 'worker', primitiveType: 'agent', prompt: 'do the task' });
    expect(complete!.success).toBe(true);
    expect(complete!.result.text).toBe('It is 20 degrees in Paris.');
    expect(complete!.result.finishReason).toBe('stop');
    expect(complete!.result.subAgentToolResults).toEqual([
      expect.objectContaining({
        toolName: 'get-weather',
        args: { city: 'Paris' },
        result: { temperature: 20, city: 'Paris' },
      }),
    ]);
    expect(delegationResultSeenBySupervisor(mock)).toContain('It is 20 degrees in Paris.');
  });

  it('reports sub-agent client tool calls (no execute) as pending and tells the supervisor', async () => {
    const mock = getMock();
    let complete: DelegationCompleteContext | undefined;

    const addToCart = createTool({
      id: 'add-to-cart',
      description: 'Add a product to the cart in the browser',
      inputSchema: z.object({ productId: z.string() }),
    });

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Add sku-1 to the cart.',
      agents: { worker: makeWorker(mock, { 'add-to-cart': addToCart }) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          complete = ctx;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on(
          { endpoint: 'chat', predicate: isWorker },
          { toolCalls: [{ id: 'sub-call-1', name: 'add-to-cart', arguments: { productId: 'sku-1' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'The cart needs the browser.' },
        );
      },
    });

    expect(complete!.result.finishReason).toBe('tool-calls');
    expect(complete!.result.subAgentToolResults).toEqual([]);
    expect(complete!.result.subAgentPendingToolCalls).toEqual([
      { toolName: 'add-to-cart', toolCallId: 'sub-call-1', args: { productId: 'sku-1' } },
    ]);
    // The sub-agent cannot run the client tool, so it is asked exactly once.
    expect(workerRequests(mock)).toHaveLength(1);
    expect(delegationResultSeenBySupervisor(mock)).toContain(
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

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Look it up.',
      agents: { worker: makeWorker(mock, { lookup }) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          complete = ctx;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'sub_call_1', name: 'lookup', arguments: { q: 'x' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) },
          { content: 'Recovered answer' },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Done.' },
        );
      },
    });

    // The sub-agent saw the tool error and recovered on its own.
    const workerFollowUp = workerRequests(mock).find(r => lastIsToolResult(r.body as ChatCompletionRequest));
    expect(JSON.stringify(workerFollowUp!.body)).toContain('lookup failed');
    expect(complete!.result.finishReason).toBe('stop');
    expect(complete!.result.text).toBe('Recovered answer');
    expect(complete!.result.subAgentPendingToolCalls).toBeUndefined();
    const seen = delegationResultSeenBySupervisor(mock);
    expect(seen).toContain('Recovered answer');
    expect(seen).not.toContain('were never run');
  });

  it('marks the delegation failed when the sub-agent run ends in a provider error', async () => {
    const mock = getMock();
    let complete: DelegationCompleteContext | undefined;

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Delegate the task.',
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      maxRetries: 0,
      delegation: {
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          complete = ctx;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on(
          { endpoint: 'chat', predicate: isWorker },
          {
            error: { message: 'WORKER_PROVIDER_BOOM', type: 'invalid_request_error', code: 'bad_request' },
            status: 400,
          },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'The worker failed.' },
        );
      },
    });

    expect(complete!.success).toBe(false);
    expect(JSON.stringify(complete!.error ?? complete!.result)).toContain('WORKER_PROVIDER_BOOM');
  });

  it('lets onDelegationComplete replace the result text the supervisor model sees', async () => {
    const mock = getMock();

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Delegate the task.',
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationComplete: (ctx: DelegationCompleteContext) =>
          ctx.result.text ? undefined : { resultText: 'The sub-agent failed to produce a result.' },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: '' });
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'I will try something else.' },
        );
      },
    });

    expect(await output.text).toBe('I will try something else.');
    expect(delegationResultSeenBySupervisor(mock)).toContain('The sub-agent failed to produce a result.');
  });

  it('stops the supervisor after a successful delegation when onDelegationComplete calls bail()', async () => {
    const mock = getMock();
    const completes: DelegationCompleteContext[] = [];

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Delegate the task.',
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationComplete: (ctx: DelegationCompleteContext) => {
          completes.push(ctx);
          ctx.bail();
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Worker finished.' });
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Supervisor kept going.' },
        );
      },
    });

    expect(completes.map(c => [c.success, c.result.text])).toEqual([[true, 'Worker finished.']]);
    expect(workerRequests(mock)).toHaveLength(1);
    // bail() ends the loop on the delegation step, so the supervisor model never reasons over the result.
    expect(supervisorRequests(mock)).toHaveLength(1);
  });

  it("saves a proceed:false rejection to the sub-agent's memory without running it", async () => {
    const mock = getMock();
    const workerMemory = new MockMemory();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const worker = new Agent({
      id: 'worker',
      name: 'worker',
      description: 'Does delegated work',
      instructions: 'You do delegated work.',
      model: openai(SCENARIO_MODEL_ID),
      memory: workerMemory,
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Delegate the task.',
      agents: { worker },
      memory: new MockMemory(),
      threadId: 'rejection-thread',
      resourceId: 'rejection-user',
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation: {
        onDelegationStart: () => ({ proceed: false, rejectionReason: 'Not allowed today.' }),
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) }, DELEGATE);
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Delegation was refused.' },
        );
      },
    });

    expect(await output.text).toBe('Delegation was refused.');
    expect(workerRequests(mock)).toHaveLength(0);
    expect(delegationResultSeenBySupervisor(mock)).toContain('Not allowed today.');

    const { threads } = await workerMemory.listThreads({ filter: { resourceId: 'rejection-user-worker' } });
    expect(threads).toHaveLength(1);
    const { messages } = await workerMemory.recall({ threadId: threads[0]!.id, resourceId: 'rejection-user-worker' });
    expect(messages.map(m => [m.role, JSON.stringify(m.content.parts)])).toEqual([
      ['user', JSON.stringify([{ type: 'text', text: 'do the task' }])],
      ['assistant', JSON.stringify([{ type: 'text', text: '[Delegation Rejected] Not allowed today.' }])],
    ]);
  });
});
