/**
 * AIMock Scenario: a sub-agent keeps streaming after its supervisor resumes.
 *
 * A supervisor asks the user a question (a suspending tool), and once resumed it
 * delegates to a sub-agent. The sub-agent's progress must reach the resumed
 * stream as `tool-output` chunks, as it does on the first segment, whether or
 * not the resume passes a request context.
 *
 * Technical: a warm durable resume that receives a request context rebuilds the
 * run's tools. It picked the method type from `closeOnSuspend`, which every
 * `resumeStream()` sets and which is also a plain `stream()` option, so the
 * delegation tool was rebuilt for `generate` and ran the sub-agent without
 * streaming its chunks (#29436).
 */

import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DurableAgent } from '../../../../agent/durable';
import { RequestContext } from '../../../../request-context';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { isDurableEngineVariant, SCENARIO_MODEL_ID } from '../types';

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isLead = (req: ChatCompletionRequest) => toolNames(req).includes('agent-helper');
const lastToolResultFor = (req: ChatCompletionRequest, toolCallId: string) => {
  const last = req.messages.at(-1);
  return last?.role === 'tool' && last.tool_call_id === toolCallId;
};

const HELPER_REPORT = 'helper report';
const LEAD_ANSWER = 'All done.';

function setup(mock: LLMock) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const echo = createTool({
    id: 'echo',
    description: 'Echoes back.',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  });
  const helper = new Agent({
    id: 'helper',
    name: 'helper',
    description: 'Does work and reports back.',
    instructions: 'You help.',
    model: openai(SCENARIO_MODEL_ID),
    tools: { echo },
  });
  const askUser = createTool({
    id: 'ask_user',
    description: 'Ask the user a question.',
    inputSchema: z.object({}),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async (_input, context) =>
      context?.agent?.resumeData ? context.agent.resumeData : await context?.agent?.suspend({ question: 'Which one?' }),
  });

  mock.on(
    { endpoint: 'chat', predicate: req => isLead(req) && req.messages.at(-1)?.role === 'user' },
    { toolCalls: [{ id: 'call-ask', name: 'ask_user', arguments: {} }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => isLead(req) && lastToolResultFor(req, 'call-ask') },
    { toolCalls: [{ id: 'call-helper', name: 'agent-helper', arguments: { prompt: 'do it' } }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => isLead(req) && lastToolResultFor(req, 'call-helper') },
    { content: LEAD_ANSWER },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => !isLead(req) && req.messages.at(-1)?.role === 'user' },
    { toolCalls: [{ id: 'call-echo', name: 'echo', arguments: {} }] },
  );
  mock.on(
    { endpoint: 'chat', predicate: req => !isLead(req) && lastToolResultFor(req, 'call-echo') },
    { content: HELPER_REPORT },
  );

  return { helper, askUser };
}

function contextFor(userId: string) {
  return new RequestContext([['userId', userId]]);
}

/** The sub-agent chunks the supervisor's stream forwarded as `tool-output`. */
async function helperStream(stream: { fullStream: AsyncIterable<ChunkType> }) {
  const types: string[] = [];
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
    if (chunk.type !== 'tool-output' || chunk.payload.toolName !== 'agent-helper') continue;
    const inner = chunk.payload.output as { type?: string } | undefined;
    if (inner?.type) types.push(inner.type);
  }
  return { types, text };
}

describeForAllEngines(
  'AIMock loop scenario: sub-agent streaming after a supervisor resume',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function suspendOnQuestion() {
      const mock = getMock();
      const { helper, askUser } = setup(mock);
      const shared = await createSharedAgent(mock, { engine, tools: { ask_user: askUser }, agents: { helper } });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm: mock,
        sharedAgent: shared,
        prompt: 'hi',
        requestContext: contextFor('u1'),
        closeOnSuspend: true,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        // Fixtures were registered by setup() before the shared agent was built.
        fixtures: () => {},
      });
      const suspended = chunks!.find(c => c.type === 'tool-call-suspended');
      expect(suspended?.payload).toMatchObject({ toolCallId: 'call-ask', toolName: 'ask_user' });
      return { shared, runId: output.runId! };
    }

    function expectHelperStreamed(result: { types: string[]; text: string }) {
      // The sub-agent's own tool call and its report reach the supervisor's stream.
      expect(result.types).toEqual(expect.arrayContaining(['tool-call', 'tool-result', 'text-delta']));
      expect(result.text).toBe(LEAD_ANSWER);
      // The sub-agent was driven through its streaming path on every model call.
      const helperRequests = getMock()
        .getRequests()
        .map(r => r.body as ChatCompletionRequest)
        .filter(req => !isLead(req));
      expect(helperRequests).toHaveLength(2);
      expect(helperRequests.every(req => req.stream === true)).toBe(true);
    }

    it('streams the sub-agent after a resume that passes a request context (#29436)', async () => {
      const { shared, runId } = await suspendOnQuestion();

      const resumed = await shared.agent.resumeStream(
        { answer: 'A' },
        { runId, toolCallId: 'call-ask', requestContext: contextFor('u1'), maxSteps: 5 },
      );

      expectHelperStreamed(await helperStream(resumed));
    });

    it('streams the sub-agent after a resume without a request context', async () => {
      const { shared, runId } = await suspendOnQuestion();

      const resumed = await shared.agent.resumeStream({ answer: 'A' }, { runId, toolCallId: 'call-ask', maxSteps: 5 });

      expectHelperStreamed(await helperStream(resumed));
    });

    describe.runIf(isDurableEngineVariant(engine))('durable resume()', () => {
      it('streams the sub-agent when resume() passes a request context and closeOnSuspend (#29436)', async () => {
        const { shared, runId } = await suspendOnQuestion();
        const agent = shared.agent as unknown as DurableAgent;

        const resumed = await agent.resume(
          runId,
          { answer: 'A' },
          { toolCallId: 'call-ask', requestContext: contextFor('u1'), closeOnSuspend: true, maxSteps: 5 },
        );
        try {
          expectHelperStreamed(await helperStream(resumed.output));
        } finally {
          resumed.cleanup();
        }
      });

      it('still runs the sub-agent through generate when a generate() run is resumed with resumeGenerate()', async () => {
        const mock = getMock();
        const { helper, askUser } = setup(mock);
        const shared = await createSharedAgent(mock, { engine, tools: { ask_user: askUser }, agents: { helper } });
        const agent = shared.agent as unknown as DurableAgent;

        const first = await agent.generate('hi', { requestContext: contextFor('u1'), maxSteps: 5 });
        expect(first.finishReason).toBe('suspended');

        const result = await agent.resumeGenerate(
          { answer: 'A' },
          { runId: first.runId!, toolCallId: 'call-ask', requestContext: contextFor('u1'), maxSteps: 5 },
        );

        expect(result.text).toBe(LEAD_ANSWER);
        const helperRequests = mock
          .getRequests()
          .map(r => r.body as ChatCompletionRequest)
          .filter(req => !isLead(req));
        expect(helperRequests).toHaveLength(2);
        expect(helperRequests.every(req => req.stream !== true)).toBe(true);
      });
    });
  },
  // File-system routing cannot represent a suspend/resume across calls.
  { skip: ['fs'] },
);
