import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A sub-agent tool that calls `suspend()` suspends the supervisor's run; the
 * caller resumes the supervisor with resume data, which must reach the
 * sub-agent's tool so the delegation and the supervisor both finish.
 *
 * Replaces "Suspension propagation" in
 * packages/core/src/agent/__tests__/supervisor-integration.test.ts.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-gatherer');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

const SUPERVISOR_ANSWER = 'The answer is 42.';

function setup(mock: LLMock) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const resumes: string[] = [];
  const infoTool = createTool({
    id: 'info-tool',
    description: 'Gathers information but needs user input.',
    inputSchema: z.object({ query: z.string() }),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: z.object({ extraInfo: z.string() }),
    execute: async (input, context) => {
      if (!context?.agent?.resumeData) {
        return await context?.agent?.suspend({ message: `Need more info for: ${input.query}` });
      }
      resumes.push(context.agent.resumeData.extraInfo);
      return { answer: `${input.query}: ${context.agent.resumeData.extraInfo}` };
    },
  });
  const gatherer = new Agent({
    id: 'gatherer',
    name: 'gatherer',
    description: 'Gathers information with a suspending tool.',
    instructions: 'Gather information with infoTool.',
    model: openai(SCENARIO_MODEL_ID),
    tools: { infoTool },
  });

  mock.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: 'call-sup-1', name: 'agent-gatherer', arguments: { prompt: 'gather information' } }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => !isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: 'call-sub-1', name: 'infoTool', arguments: { query: 'meaning of life' } }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => !isSupervisor(req) && lastIsToolResult(req) },
    { content: 'meaning of life: 42' },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
    { content: SUPERVISOR_ANSWER },
  );

  return { gatherer, resumes };
}

describeForAllEngines('AIMock loop scenario: supervisor sub-agent suspension', engine => {
  const getMock = useLoopScenarioAimock();

  it('suspends the supervisor on a sub-agent suspend() and resumes the sub-agent tool with resume data', async () => {
    const mock = getMock();
    const { gatherer, resumes } = setup(mock);
    const shared = await createSharedAgent(mock, { engine, agents: { gatherer }, memory: new MockMemory() });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: mock,
      sharedAgent: shared,
      prompt: 'Gather some info',
      threadId: 'supervisor-suspension-thread',
      resourceId: 'supervisor-suspension-user',
      stopWhen: stepCountIs(5),
      collectChunks: true,
      // Fixtures were registered by setup() before the shared agent was built.
      fixtures: () => {},
    });
    const suspended = chunks!.find(c => c.type === 'tool-call-suspended') as any;
    expect(suspended?.payload.toolName).toBe('agent-gatherer');
    expect(JSON.stringify(suspended?.payload.suspendPayload)).toContain('Need more info for: meaning of life');
    expect(resumes).toEqual([]);

    const resumed = await shared.agent.resumeStream(
      { extraInfo: 'the answer is 42' },
      {
        runId: output.runId,
        memory: { thread: 'supervisor-suspension-thread', resource: 'supervisor-suspension-user' },
      },
    );
    const types: string[] = [];
    for await (const chunk of resumed.fullStream) types.push(chunk.type);

    expect(types).not.toContain('tool-call-suspended');
    expect(resumes).toEqual(['the answer is 42']);
    const subToolResult = mock
      .getRequests()
      .map(r => r.body as ChatCompletionRequest)
      .find(req => !isSupervisor(req) && lastIsToolResult(req));
    expect(JSON.stringify(subToolResult?.messages.at(-1)?.content)).toContain('meaning of life: the answer is 42');
    expect(await resumed.text).toBe(SUPERVISOR_ANSWER);
  });
});

// generate()/resumeGenerate() run only on the plain Agent, so this case is not engine-parameterised.
describe('AIMock loop scenario: supervisor sub-agent suspension (generate)', () => {
  const getMock = useLoopScenarioAimock();

  it('returns finishReason suspended from generate() and stop from resumeGenerate()', async () => {
    const mock = getMock();
    const { gatherer, resumes } = setup(mock);
    const shared = await createSharedAgent(mock, { engine: 'normal', agents: { gatherer }, memory: new MockMemory() });
    const memory = { thread: 'supervisor-suspension-generate', resource: 'supervisor-suspension-user' };

    const output = await shared.agent.generate('Gather some info', { maxSteps: 5, memory });
    expect(output.finishReason).toBe('suspended');
    expect(JSON.stringify(output.suspendPayload)).toContain('Need more info for: meaning of life');

    const resumed = await shared.agent.resumeGenerate(
      { extraInfo: 'the answer is 42' },
      { runId: output.runId!, memory },
    );

    expect(resumed.finishReason).toBe('stop');
    expect(resumed.suspendPayload).toBeUndefined();
    expect(resumes).toEqual(['the answer is 42']);
    expect(resumed.text).toBe(SUPERVISOR_ANSWER);
  });
});
