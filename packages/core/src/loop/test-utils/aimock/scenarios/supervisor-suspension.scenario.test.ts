import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi } from 'vitest';
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
 * The supervisor raises the pause on its own delegation call, which is what resumes
 * it. The pause also names the sub-agent's own tool call (`delegatedToolCallId` /
 * `delegatedToolName`), live and on the saved `suspendedTools` entry, so a UI can tell
 * which sub-agent tool paused (#28583).
 *
 * Replaces "Suspension propagation" in
 * packages/core/src/agent/__tests__/supervisor-integration.test.ts.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-gatherer');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

const SUPERVISOR_ANSWER = 'The answer is 42.';

type SubCall = { id: string; query: string };

function setup(mock: LLMock, subCalls: SubCall[] = [{ id: 'call-sub-1', query: 'meaning of life' }]) {
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
    { toolCalls: subCalls.map(call => ({ id: call.id, name: 'infoTool', arguments: { query: call.query } })) },
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

/** The `suspendedTools` entries saved on the thread for the supervisor's delegation call. */
async function savedSuspension(memory: MockMemory, thread: string, resource: string, delegatedToolCallId: string) {
  return vi.waitFor(async () => {
    const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
    const entry = messages
      .flatMap(m => Object.values(((m.content as any)?.metadata?.suspendedTools ?? {}) as Record<string, any>))
      .find(e => e.delegatedToolCallId === delegatedToolCallId);
    expect(entry, `saved suspension for ${delegatedToolCallId}`).toBeDefined();
    return entry;
  });
}

describeForAllEngines('AIMock loop scenario: supervisor sub-agent suspension', engine => {
  const getMock = useLoopScenarioAimock();

  it('suspends the supervisor on a sub-agent suspend() and resumes the sub-agent tool with resume data', async () => {
    const mock = getMock();
    const { gatherer, resumes } = setup(mock);
    const memory = new MockMemory();
    const shared = await createSharedAgent(mock, { engine, agents: { gatherer }, memory });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: mock,
      sharedAgent: shared,
      memory,
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
    // Resumed through the delegation call, but names the sub-agent's tool call that paused.
    expect(suspended?.payload).toMatchObject({
      toolCallId: 'call-sup-1',
      delegatedToolCallId: 'call-sub-1',
      delegatedToolName: 'infoTool',
    });
    const saved = await savedSuspension(
      memory,
      'supervisor-suspension-thread',
      'supervisor-suspension-user',
      'call-sub-1',
    );
    expect(saved).toMatchObject({
      toolCallId: 'call-sup-1',
      toolName: 'agent-gatherer',
      delegatedToolName: 'infoTool',
    });

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

  it('surfaces parallel sub-agent suspensions one at a time, each naming its own call', async () => {
    const mock = getMock();
    const { gatherer, resumes } = setup(mock, [
      { id: 'call-sub-color', query: 'color' },
      { id: 'call-sub-size', query: 'size' },
    ]);
    const memory = new MockMemory();
    const shared = await createSharedAgent(mock, { engine, agents: { gatherer }, memory });
    const memoryOptions = { thread: 'supervisor-suspension-parallel', resource: 'supervisor-suspension-user' };

    let run = await shared.agent.stream('Gather color and size', { memory: memoryOptions, maxSteps: 5 });
    const paused: { call?: string; message?: string; saved?: string }[] = [];
    for (const extraInfo of ['red', 'large']) {
      let suspended: any;
      for await (const chunk of run.fullStream) {
        if (chunk.type === 'tool-call-suspended') {
          suspended = chunk.payload;
          // Durable streams stay open while suspended; stop at the pause.
          break;
        }
      }
      expect(suspended, 'run paused on a sub-agent suspension').toMatchObject({ toolCallId: 'call-sup-1' });
      const saved = await savedSuspension(
        memory,
        memoryOptions.thread,
        memoryOptions.resource,
        suspended.delegatedToolCallId,
      );
      paused.push({
        call: suspended.delegatedToolCallId,
        message: suspended.suspendPayload?.message,
        saved: saved.delegatedToolCallId,
      });
      run = await shared.agent.resumeStream({ extraInfo }, { runId: run.runId, memory: memoryOptions, maxSteps: 5 });
    }
    for await (const _chunk of run.fullStream) {
      // drain the final resume
    }

    // Each pause names its own call, and its question belongs to that call.
    expect(paused).toEqual([
      { call: 'call-sub-color', message: 'Need more info for: color', saved: 'call-sub-color' },
      { call: 'call-sub-size', message: 'Need more info for: size', saved: 'call-sub-size' },
    ]);
    expect(resumes).toEqual(['red', 'large']);
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
    expect(output.suspendPayload).toMatchObject({
      toolCallId: 'call-sup-1',
      delegatedToolCallId: 'call-sub-1',
      delegatedToolName: 'infoTool',
    });

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
