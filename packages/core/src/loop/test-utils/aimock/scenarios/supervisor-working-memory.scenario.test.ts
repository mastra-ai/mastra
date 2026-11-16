import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import type { DelegationCompleteContext } from '../../../../agent/agent.types';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A sub-agent without its own memory runs on the supervisor's memory. With
 * working memory enabled it gets the `updateWorkingMemory` tool, the update
 * succeeds (issue #9873: it used to fail for lack of thread/resource ids), and
 * because the sub-agent's resource id is derived from the parent's
 * (`<resource>-<agent>`) the saved working memory is injected into the
 * sub-agent's prompt on a later delegation in a new run.
 *
 * Replaces the real-OpenAI "working memory forwarding" test and the
 * "working memory across delegations" test from
 * packages/core/src/agent/__tests__/supervisor-integration.test.ts.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

const WORKER_INSTRUCTIONS = 'You handle entity operations. Use working memory to remember entity data.';
const ENTITY_MEMORY = '# Entity\n- **Record**: 401881\n';
const THREAD_ID = 'supervisor-wm-thread';
const RESOURCE_ID = 'supervisor-wm-user';

function makeWorker(mock: LLMock) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Handles entity operations',
    instructions: WORKER_INSTRUCTIONS,
    model: openai(SCENARIO_MODEL_ID),
  });
}

function supervisorFixtures(llm: LLMock, prompt: string) {
  llm.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: 'call-sup-1', name: 'agent-worker', arguments: { prompt } }] },
  );
  llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) }, { content: 'Done' });
}

describeForAllEngines('AIMock loop scenario: supervisor working memory', engine => {
  const getMock = useLoopScenarioAimock();

  it('lets a sub-agent update working memory and sees it again on a later delegation', async () => {
    const mock = getMock();
    const memory = new MockMemory({ enableWorkingMemory: true });
    const worker = makeWorker(mock);
    const completions: DelegationCompleteContext[] = [];
    const delegation = { onDelegationComplete: (ctx: DelegationCompleteContext) => void completions.push(ctx) };

    const first = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Find record X',
      agents: { worker },
      memory,
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => !isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-wm', name: 'updateWorkingMemory', arguments: { memory: ENTITY_MEMORY } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => !isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Found entity 401881' },
        );
        supervisorFixtures(llm, 'Find record X');
      },
    });

    const workerFollowUp = first.requests.find(
      r => !isSupervisor(r.body as ChatCompletionRequest) && lastIsToolResult(r.body as ChatCompletionRequest),
    );
    const wmResult = (workerFollowUp!.body as ChatCompletionRequest).messages.at(-1);
    expect(wmResult?.content).toBe('{"success":true}');
    expect(completions).toHaveLength(1);
    expect(completions[0]!.result.subAgentResourceId).toBe(`${RESOURCE_ID}-worker`);

    mock.clearRequests();
    mock.clearFixtures();
    mock.resetMatchCounts();

    const second = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Now update the entity',
      agents: { worker },
      memory,
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      stopWhen: stepCountIs(5),
      errorProcessors: [],
      delegation,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: req => !isSupervisor(req) }, { content: 'Updated entity' });
        supervisorFixtures(llm, 'Update the entity');
      },
    });

    expect(completions).toHaveLength(2);
    expect(completions[1]!.result.subAgentResourceId).toBe(completions[0]!.result.subAgentResourceId);
    const workerRequest = second.requests.find(r => !isSupervisor(r.body as ChatCompletionRequest));
    const workerSystem = (workerRequest!.body as ChatCompletionRequest).messages
      .filter(m => m.role === 'system')
      .map(m => JSON.stringify(m.content))
      .join('\n');
    expect(workerSystem).toContain('401881');
    expect(await second.output.text).toBe('Done');
  });
});
