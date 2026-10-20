import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DelegationStartContext } from '../../../../agent';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * What a delegated sub-agent run inherits from the supervisor run:
 *
 * - the parent abort signal (#14820), so aborting the supervisor cancels the sub-agent;
 * - a maxSteps budget: the model-provided value is capped at the sub-agent's
 *   `defaultOptions.maxSteps`, and `onDelegationStart`'s `modifiedMaxSteps` bypasses the cap;
 * - a derived request context: parent entries are inherited, reserved memory keys are not,
 *   hook mutations reach the sub-agent's tools, and nothing the delegated run writes leaks back.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const isWorker = (req: ChatCompletionRequest) => !isSupervisor(req);

function makeWorker(mock: LLMock, options: { tools?: Record<string, any>; maxSteps?: number } = {}) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Does delegated work',
    instructions: 'You do delegated work.',
    model: openai(SCENARIO_MODEL_ID),
    ...(options.tools ? { tools: options.tools } : {}),
    ...(options.maxSteps ? { defaultOptions: { maxSteps: options.maxSteps } } : {}),
  });
}

function delegate(llm: LLMock, args: Record<string, unknown> = { prompt: 'do the task' }) {
  llm.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: args }] },
  );
  llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) }, { content: 'Done.' });
}

const workerRequestCount = (requests: { body: unknown }[]) =>
  requests.filter(r => isWorker(r.body as ChatCompletionRequest)).length;

describeForAllEngines('AIMock loop scenario: supervisor delegation limits', engine => {
  const getMock = useLoopScenarioAimock();

  it('aborts the delegated sub-agent when the supervisor is aborted', async () => {
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

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'go',
      agents: { worker: makeWorker(mock, { tools: { probe } }) },
      stopWhen: stepCountIs(5),
      abortSignal: controller.signal,
      errorProcessors: [],
      fixtures: llm => {
        delegate(llm);
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call_probe', name: 'probe', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) }, { content: 'Worked.' });
      },
    });

    expect(signalBeforeAbort).toBe(false);
    expect(signalAfterAbort).toBe(true);
    // The aborted sub-agent never asks its model to continue after the probe.
    expect(workerRequestCount(requests)).toBe(1);
  });

  // The worker model always calls its tool, so the number of worker requests is
  // exactly the maxSteps budget the delegated run received.
  async function workerBudget(opts: { workerDefault?: number; modelMaxSteps?: number; modifiedMaxSteps?: number }) {
    const mock = getMock();
    const tick = createTool({
      id: 'tick',
      description: 'Does one step of work.',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
    });
    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'go',
      agents: { worker: makeWorker(mock, { tools: { tick }, maxSteps: opts.workerDefault }) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      ...(opts.modifiedMaxSteps
        ? { delegation: { onDelegationStart: () => ({ proceed: true, modifiedMaxSteps: opts.modifiedMaxSteps }) } }
        : {}),
      fixtures: llm => {
        delegate(llm, { prompt: 'do the task', maxSteps: opts.modelMaxSteps });
        llm.on(
          { endpoint: 'chat', predicate: isWorker },
          { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
        );
      },
    });
    return workerRequestCount(requests);
  }

  it("caps the model-provided maxSteps at the sub-agent's defaultOptions.maxSteps", async () => {
    expect(await workerBudget({ workerDefault: 2, modelMaxSteps: 6 })).toBe(2);
  });

  // The delegation tool schema rejects model-provided maxSteps below 3.
  it('keeps the model-provided maxSteps when it is below the sub-agent default', async () => {
    expect(await workerBudget({ workerDefault: 5, modelMaxSteps: 3 })).toBe(3);
  });

  it('passes the model-provided maxSteps through when the sub-agent has no default', async () => {
    expect(await workerBudget({ modelMaxSteps: 3 })).toBe(3);
  });

  it('lets onDelegationStart modifiedMaxSteps bypass the cap', async () => {
    expect(await workerBudget({ workerDefault: 2, modelMaxSteps: 6, modifiedMaxSteps: 4 })).toBe(4);
  });

  it('derives the delegated request context from the parent without leaking either way', async () => {
    const mock = getMock();
    let hookSaw: Record<string, unknown> | undefined;
    let toolSaw: Record<string, unknown> | undefined;
    const contextTool = createTool({
      id: 'context-tool',
      description: 'Reads and writes request context.',
      inputSchema: z.object({}),
      execute: async (_input, ctx) => {
        toolSaw = { tenantId: ctx?.requestContext?.get('tenantId'), specialty: ctx?.requestContext?.get('specialty') };
        ctx?.requestContext?.set('subAgentWrote', true);
        return { ok: true };
      },
    });
    const parentContext = new RequestContext();
    parentContext.set('tenantId', 'acme');
    parentContext.set(MASTRA_THREAD_ID_KEY, 'parent-thread');
    parentContext.set(MASTRA_RESOURCE_ID_KEY, 'parent-resource');

    await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'go',
      agents: { worker: makeWorker(mock, { tools: { contextTool } }) },
      stopWhen: stepCountIs(5),
      requestContext: parentContext,
      errorProcessors: [],
      delegation: {
        onDelegationStart: (context: DelegationStartContext) => {
          const rc = context.requestContext;
          hookSaw = {
            tenantId: rc.get('tenantId'),
            memory: rc.has('MastraMemory'),
            threadId: rc.has(MASTRA_THREAD_ID_KEY),
            resourceId: rc.has(MASTRA_RESOURCE_ID_KEY),
            sameObject: rc === parentContext,
          };
          rc.set('specialty', context.primitiveId);
          return { proceed: true };
        },
      },
      fixtures: llm => {
        delegate(llm);
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call_ctx', name: 'context-tool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) }, { content: 'Worked.' });
      },
    });

    expect(hookSaw).toEqual({ tenantId: 'acme', memory: false, threadId: false, resourceId: false, sameObject: false });
    expect(toolSaw).toEqual({ tenantId: 'acme', specialty: 'worker' });
    expect(parentContext.has('specialty')).toBe(false);
    expect(parentContext.has('subAgentWrote')).toBe(false);
    expect(parentContext.get('tenantId')).toBe('acme');
  });
});
