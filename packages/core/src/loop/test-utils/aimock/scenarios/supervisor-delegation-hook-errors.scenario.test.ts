import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import type { DelegationConfig, DelegationHookError } from '../../../../agent';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Supervisor delegation hooks that throw.
 *
 * By default a throwing hook fails open: the delegation still runs (or keeps
 * its original result / unfiltered context). With `hookErrorStrategy: 'throw'`
 * a throwing `onDelegationStart` blocks the delegation. Every hook failure is
 * recorded on the run's request context under `__mastra_delegationHookErrors`
 * so callers can see it without reading logs.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const isWorker = (req: ChatCompletionRequest) => !isSupervisor(req);

const PROMPT = 'Research the migration of humpback whales.';
const WORKER_ANSWER = 'Humpbacks migrate up to 8,000 km.';
const SUPERVISOR_ANSWER = 'Summary delivered.';

function makeWorker(mock: LLMock) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Does research',
    instructions: 'You do research.',
    model: openai(SCENARIO_MODEL_ID),
  });
}

const hookErrors = (requestContext: RequestContext) =>
  (requestContext.get('__mastra_delegationHookErrors') as DelegationHookError[] | undefined) ?? [];

describeForAllEngines('AIMock loop scenario: supervisor delegation hook errors', engine => {
  const getMock = useLoopScenarioAimock();

  async function run(delegation: DelegationConfig) {
    const mock = getMock();
    const requestContext = new RequestContext();
    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: PROMPT,
      agents: { worker: makeWorker(mock) },
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      requestContext,
      delegation,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'research whales' } }] },
        );
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: WORKER_ANSWER });
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: SUPERVISOR_ANSWER },
        );
      },
    });
    const requests = mock.getRequests().map(r => r.body as ChatCompletionRequest);
    const workerRequests = requests.filter(isWorker);
    const followUp = requests.find(req => isSupervisor(req) && lastIsToolResult(req));
    const seenBySupervisor = JSON.stringify(followUp?.messages.at(-1)?.content ?? null);
    return { output, requestContext, workerRequests, seenBySupervisor };
  }

  it('records a throwing onDelegationStart and still delegates by default', async () => {
    const { output, requestContext, workerRequests, seenBySupervisor } = await run({
      onDelegationStart: () => {
        throw new Error('start hook boom');
      },
    });

    expect(await output.text).toBe(SUPERVISOR_ANSWER);
    expect(workerRequests).toHaveLength(1);
    expect(seenBySupervisor).toContain(WORKER_ANSWER);
    expect(hookErrors(requestContext)).toEqual([
      expect.objectContaining({ hook: 'onDelegationStart', primitiveId: 'worker', message: 'start hook boom' }),
    ]);
  });

  it('blocks the delegation when onDelegationStart throws under hookErrorStrategy: throw', async () => {
    const { requestContext, workerRequests, seenBySupervisor } = await run({
      hookErrorStrategy: 'throw',
      onDelegationStart: () => {
        throw new Error('start hook boom');
      },
    });

    expect(workerRequests).toHaveLength(0);
    expect(seenBySupervisor).not.toContain(WORKER_ANSWER);
    expect(hookErrors(requestContext)).toEqual([expect.objectContaining({ hook: 'onDelegationStart' })]);
  });

  it('records a throwing onDelegationComplete and keeps the original result by default', async () => {
    const { requestContext, seenBySupervisor } = await run({
      onDelegationComplete: () => {
        throw new Error('complete hook boom');
      },
    });

    expect(seenBySupervisor).toContain(WORKER_ANSWER);
    expect(hookErrors(requestContext)).toEqual([
      expect.objectContaining({ hook: 'onDelegationComplete', message: 'complete hook boom' }),
    ]);
  });

  it('does not re-enter onDelegationComplete when it throws under hookErrorStrategy: throw', async () => {
    const calls: boolean[] = [];
    const { requestContext } = await run({
      hookErrorStrategy: 'throw',
      onDelegationComplete: ctx => {
        calls.push(ctx.success);
        throw new Error('complete hook boom');
      },
    });

    // A second call with success: false would mean the hook failure re-entered the hook as a delegation failure.
    expect(calls).toEqual([true]);
    expect(hookErrors(requestContext)).toEqual([expect.objectContaining({ hook: 'onDelegationComplete' })]);
  });

  it('records a throwing messageFilter and forwards the unfiltered parent context', async () => {
    const { requestContext, workerRequests } = await run({
      messageFilter: () => {
        throw new Error('filter boom');
      },
    });

    expect(workerRequests).toHaveLength(1);
    expect(JSON.stringify(workerRequests[0]!.messages)).toContain(PROMPT);
    expect(hookErrors(requestContext)).toEqual([
      expect.objectContaining({ hook: 'messageFilter', message: 'filter boom' }),
    ]);
  });
});
