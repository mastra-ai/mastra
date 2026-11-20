import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LLMock } from '@copilotkit/aimock';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import { assembleAgentFromFsEntry } from '../../../../agent/fs-routing';
import { createScorer } from '../../../../evals';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, isDurableEngineVariant, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineVariant } from '../types';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: live scorers and `returnScorerData` on agent runs.
 *
 * A live scorer is observable through its own `generateScore` step running
 * against the finished run, and `returnScorerData` through `scoringData` on the
 * full output. Both must hold on every engine, for `generate()` and `stream()`,
 * for call-time scorer overrides, and for a run that suspends and resumes —
 * which must be scored once, after it completes, under its original runId.
 */

type ScorerRun = { runId: string; input: any; output: unknown };

function recordingScorer(id: string) {
  const runs: ScorerRun[] = [];
  const scorer = createScorer({ id, name: id, description: `records ${id} runs` }).generateScore(({ run }) => {
    runs.push({ runId: run.runId, input: run.input, output: run.output });
    return 1;
  });
  return { scorer, runs };
}

let agentCounter = 0;

/**
 * Builds a scored agent on the AIMock provider and registers it on a Mastra
 * with storage, wrapped for the engine under test. The shared harness builder
 * has no `scorers` option, so this mirrors it with scorers added.
 */
function buildScoredAgent(
  llm: LLMock,
  engine: EngineVariant,
  {
    scorers,
    mastraScorers,
    tools,
    defaultOptions,
    memory,
    id = `scorers-live-agent-${++agentCounter}`,
    storage = new InMemoryStore(),
  }: {
    scorers?: Record<string, { scorer: any }>;
    mastraScorers?: Record<string, any>;
    tools?: Record<string, any>;
    defaultOptions?: Record<string, any>;
    memory?: MockMemory;
    id?: string;
    storage?: InMemoryStore;
  } = {},
) {
  const model = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(
    SCENARIO_MODEL_ID,
  );
  const instructions = 'You are a test agent driven by scripted AIMock responses.';
  const config = {
    model,
    ...(scorers ? { scorers } : {}),
    ...(defaultOptions ? { defaultOptions } : {}),
    ...(memory ? { memory } : {}),
  };

  const agent =
    engine === 'fs'
      ? assembleAgentFromFsEntry({
          name: id,
          config,
          instructionsMd: instructions,
          ...(tools ? { tools: Object.entries(tools).map(([key, tool]) => ({ key, tool })) } : {}),
        })
      : new Agent({ id, name: id, instructions, ...config, ...(tools ? { tools } : {}) });

  const pubsub = engine === 'evented' ? new EventEmitterPubSub() : undefined;
  const registrable =
    engine === 'durable'
      ? createDurableAgent({ agent })
      : engine === 'evented'
        ? createEventedAgent({ agent, pubsub })
        : agent;

  const mastra = new Mastra({
    agents: engine === 'fs' ? {} : { [id]: registrable as any },
    logger: false,
    storage,
    ...(mastraScorers ? { scorers: mastraScorers } : {}),
    ...(pubsub ? { pubsub } : {}),
  });
  if (engine === 'fs') mastra.__registerFsAgents({ [id]: registrable as any });

  return mastra.getAgent(id) as any;
}

/** Streams to completion (or the next suspension) and returns the full output. */
async function streamToEnd(agent: any, engine: EngineVariant, run: Promise<any>) {
  const raw = await run;
  const output = raw.output ?? raw;
  const fullStream = raw.fullStream ?? output.fullStream;
  let suspended = false;
  for await (const chunk of fullStream) {
    if (chunk.type === 'tool-call-suspended') {
      suspended = true;
      // Durable streams stay open while suspended.
      if (isDurableEngineVariant(engine)) break;
    }
  }
  const full = suspended ? undefined : await output.getFullOutput();
  if (!suspended) raw.cleanup?.();
  return { runId: (raw.runId ?? output.runId) as string, full, suspended };
}

const toolNamesIn = (messages: unknown) =>
  ((messages ?? []) as any[]).flatMap(message =>
    (message.content?.parts ?? [])
      .filter((part: any) => part.type === 'tool-invocation')
      .map((part: any) => part.toolInvocation.toolName),
  );

const textFixture = (reply: string) => (llm: LLMock) => {
  llm.on({ endpoint: 'chat' }, { content: reply });
};

describeForAllEngines('AIMock loop scenario: live scorers and returnScorerData', engine => {
  const getMock = useLoopScenarioAimock();

  it('an agent-level scorer scores the finished run under its runId', async () => {
    textFixture('Scored reply')(getMock());
    const { scorer, runs } = recordingScorer('agent-default');
    const agent = buildScoredAgent(getMock(), engine, { scorers: { agentDefault: { scorer } } });

    const { runId } = await streamToEnd(agent, engine, agent.stream('score me'));

    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0]!.runId).toBe(runId);
    expect(JSON.stringify(runs[0]!.output)).toContain('Scored reply');
  });

  it('stream() returns scoringData only when returnScorerData is set', async () => {
    textFixture('Durable scored stream')(getMock());
    const agent = buildScoredAgent(getMock(), engine);

    const on = await streamToEnd(agent, engine, agent.stream('score me', { returnScorerData: true }));
    expect(on.full!.text).toBe('Durable scored stream');
    expect(JSON.stringify(on.full!.scoringData!.input.inputMessages)).toContain('score me');
    expect(on.full!.scoringData!.input).toMatchObject({
      rememberedMessages: expect.any(Array),
      systemMessages: expect.any(Array),
    });
    expect(JSON.stringify(on.full!.scoringData!.output)).toContain('Durable scored stream');

    const off = await streamToEnd(agent, engine, agent.stream('no scoring'));
    expect(off.full!.scoringData).toBeUndefined();
  });

  it('generate() returns scoringData only when returnScorerData is set', async () => {
    textFixture('Generated reply')(getMock());
    const agent = buildScoredAgent(getMock(), engine);

    const on = await agent.generate('score me', { returnScorerData: true });
    expect(on.text).toBe('Generated reply');
    expect(JSON.stringify(on.scoringData.input.inputMessages)).toContain('score me');
    expect(JSON.stringify(on.scoringData.output)).toContain('Generated reply');

    const unset = await agent.generate('no scoring');
    expect(unset.scoringData).toBeUndefined();

    const off = await agent.generate('no scoring', { returnScorerData: false });
    expect(off.scoringData).toBeUndefined();
  });

  // #27580: the run-level returnScorerData is persisted with the suspended run, so a
  // resume keeps it even when defaultOptions disable it.
  it('returnScorerData set on the run survives an approval resume, even when defaultOptions disable it', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-search', name: 'searchTool', arguments: { query: 'mastra' } }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call-search' }, { content: 'Found: mastra' });
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });
    const agent = buildScoredAgent(llm, engine, {
      tools: { searchTool },
      defaultOptions: { returnScorerData: false },
    });

    const first = await agent.generate('search for mastra', { requireToolApproval: true, returnScorerData: true });
    expect(first.finishReason).toBe('suspended');

    const second = await agent.resumeGenerate({ approved: true }, { runId: first.runId });
    expect(second.text).toBe('Found: mastra');
    expect(JSON.stringify(second.scoringData?.output)).toContain('Found: mastra');
  });

  // #27580: the flag must come from the suspended run in storage, not from the
  // process that started it, so the resume runs on a fresh Agent and Mastra.
  it.each([
    { method: 'resumeGenerate', resumeFlag: undefined, expectScoringData: true },
    { method: 'resumeStream', resumeFlag: undefined, expectScoringData: true },
    { method: 'resumeGenerate', resumeFlag: false, expectScoringData: false },
  ] as const)(
    'a fresh process resuming with $method keeps the run returnScorerData (resume flag: $resumeFlag)',
    async ({ method, resumeFlag, expectScoringData }) => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call-search', name: 'searchTool', arguments: { query: 'mastra' } }] },
      );
      llm.on({ endpoint: 'chat', toolCallId: 'call-search' }, { content: 'Found: mastra' });
      const searchTool = createTool({
        id: 'searchTool',
        description: 'Search for information',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ results: ['mastra'] }),
      });
      const storage = new InMemoryStore();
      const id = `scorers-live-cross-process-${++agentCounter}`;
      const build = () =>
        buildScoredAgent(llm, engine, {
          id,
          storage,
          tools: { searchTool },
          defaultOptions: { returnScorerData: false },
        });

      const first = await build().generate('search for mastra', { requireToolApproval: true, returnScorerData: true });
      expect(first.finishReason).toBe('suspended');

      const resumer = build();
      const resumeOptions = {
        runId: first.runId,
        ...(resumeFlag === undefined ? {} : { returnScorerData: resumeFlag }),
      };
      const full =
        method === 'resumeGenerate'
          ? await resumer.resumeGenerate({ approved: true }, resumeOptions)
          : (await streamToEnd(resumer, engine, resumer.resumeStream({ approved: true }, resumeOptions))).full;

      expect(full.text).toBe('Found: mastra');
      if (expectScoringData) {
        expect(JSON.stringify(full.scoringData?.output)).toContain('Found: mastra');
      } else {
        expect(full.scoringData).toBeUndefined();
      }
    },
  );

  it('call-time scorers replace the agent scorers on stream() and generate()', async () => {
    textFixture('Override reply')(getMock());
    const agentDefault = recordingScorer('agent-default');
    const override = recordingScorer('call-override');
    const agent = buildScoredAgent(getMock(), engine, {
      scorers: { agentDefault: { scorer: agentDefault.scorer } },
      mastraScorers: { callOverride: override.scorer },
    });

    const streamed = await streamToEnd(
      agent,
      engine,
      agent.stream('score me', { scorers: { callOverride: { scorer: override.scorer } } }),
    );
    await vi.waitFor(() => expect(override.runs).toHaveLength(1));
    expect(override.runs[0]!.runId).toBe(streamed.runId);

    const generated = await agent.generate('score me again', {
      scorers: { callOverride: { scorer: override.scorer } },
    });
    await vi.waitFor(() => expect(override.runs).toHaveLength(2));
    expect(override.runs[1]!.runId).toBe(generated.runId);

    expect(agentDefault.runs).toHaveLength(0);
  });

  it('a call-time scorer can name a scorer registered on Mastra', async () => {
    textFixture('Named reply')(getMock());
    const agentDefault = recordingScorer('agent-default');
    const named = recordingScorer('named-scorer');
    const agent = buildScoredAgent(getMock(), engine, {
      scorers: { agentDefault: { scorer: agentDefault.scorer } },
      mastraScorers: { namedScorer: named.scorer },
    });

    const { runId } = await streamToEnd(
      agent,
      engine,
      agent.stream('score me', { scorers: { namedScorer: { scorer: 'named-scorer' } } }),
    );

    await vi.waitFor(() => expect(named.runs).toHaveLength(1));
    expect(named.runs[0]!.runId).toBe(runId);
    expect(agentDefault.runs).toHaveLength(0);
  });

  it.each([{ withMemory: false }, { withMemory: true }])(
    'a run that suspends twice is scored once, after it completes, under its original runId (memory: $withMemory)',
    async ({ withMemory }) => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [
            { id: 'call-a', name: 'toolA', arguments: {} },
            { id: 'call-b', name: 'toolB', arguments: {} },
          ],
        },
      );
      llm.on(
        { endpoint: 'chat', toolCallId: 'call-b' },
        { toolCalls: [{ id: 'call-ask-1', name: 'askUser', arguments: {} }] },
      );
      llm.on(
        { endpoint: 'chat', toolCallId: 'call-ask-1' },
        { toolCalls: [{ id: 'call-ask-2', name: 'askUser', arguments: {} }] },
      );
      llm.on(
        { endpoint: 'chat', toolCallId: 'call-ask-2' },
        { toolCalls: [{ id: 'call-c', name: 'toolC', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', toolCallId: 'call-c' }, { content: 'All done' });

      const simple = (id: string) =>
        createTool({ id, description: id, inputSchema: z.object({}), execute: async () => ({ ok: id }) });
      const askUser = createTool({
        id: 'askUser',
        description: 'Ask the user a question',
        inputSchema: z.object({}),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question: 'Which one?' });
          return { answer: context.agent.resumeData.answer };
        },
      });

      const { scorer, runs } = recordingScorer('resume-scorer');
      const agent = buildScoredAgent(llm, engine, {
        scorers: { resumeScorer: { scorer } },
        tools: { toolA: simple('toolA'), toolB: simple('toolB'), toolC: simple('toolC'), askUser },
        ...(withMemory ? { memory: new MockMemory() } : {}),
      });
      const memoryOptions = withMemory ? { memory: { thread: 'thread-1', resource: 'resource-1' } } : {};

      const first = await streamToEnd(agent, engine, agent.stream('Do the task', { maxSteps: 10, ...memoryOptions }));
      expect(first.suspended).toBe(true);

      const second = await streamToEnd(
        agent,
        engine,
        agent.resumeStream({ answer: 'first' }, { runId: first.runId, ...memoryOptions }),
      );
      expect(second.suspended).toBe(true);
      expect(runs).toHaveLength(0);

      const third = await streamToEnd(
        agent,
        engine,
        agent.resumeStream({ answer: 'second' }, { runId: first.runId, ...memoryOptions }),
      );
      expect(third.full!.text).toBe('All done');

      await vi.waitFor(() => expect(runs).toHaveLength(1));
      expect(runs[0]!.runId).toBe(first.runId);
      expect(toolNamesIn(runs[0]!.output)).toEqual(['toolA', 'toolB', 'askUser', 'askUser', 'toolC']);
      // Earlier segments of the same run are output, not remembered history.
      expect(toolNamesIn(runs[0]!.input.rememberedMessages)).toEqual([]);
    },
  );

  // #27579: a live scorer object passed only at call time (or via
  // `defaultOptions.scorers`) runs even when registered on neither the agent nor Mastra.
  it('a call-time scorer that is not registered on the agent or Mastra still runs', async () => {
    textFixture('Unregistered reply')(getMock());
    const { scorer, runs } = recordingScorer('call-only');
    const agent = buildScoredAgent(getMock(), engine);

    await streamToEnd(agent, engine, agent.stream('score me', { scorers: { callOnly: { scorer } } }));

    await vi.waitFor(() => expect(runs).toHaveLength(1));
  });

  it('a scorer set in defaultOptions.scorers still runs', async () => {
    textFixture('Default options reply')(getMock());
    const { scorer, runs } = recordingScorer('default-options');
    const agent = buildScoredAgent(getMock(), engine, { defaultOptions: { scorers: { viaDefaults: { scorer } } } });

    await streamToEnd(agent, engine, agent.stream('score me'));

    await vi.waitFor(() => expect(runs).toHaveLength(1));
  });
});
