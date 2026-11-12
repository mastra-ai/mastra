import type { AddressInfo } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import {
  createDatasetSnapshot,
  parseDatasetSnapshot,
  datasetItemsFromThread,
  runExperiment,
} from '@mastra/core/datasets';
import type { AgentExperimentOutput, ConversationReplayInput } from '@mastra/core/datasets';
import { createScorer, notScorable } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createTrajectoryAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraServer } from '../index';

const user = (text: string) => ({
  role: 'user' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
});
const input: ConversationReplayInput = {
  type: 'conversation',
  turns: [
    {
      input: [user('First order')],
      groundTruth: 'Candidate one',
      toolMocks: [{ toolName: 'lookup', args: { id: 42 }, output: { status: 'first' } }],
      expectedTrajectory: { steps: [{ stepType: 'tool_call', name: 'lookup' }], ordering: 'strict' },
    },
    {
      input: [user('Second order')],
      groundTruth: 'Candidate two',
      toolMocks: [{ toolName: 'lookup', args: { id: 42 }, output: { status: 'second' } }],
      expectedTrajectory: { steps: [{ stepType: 'tool_call', name: 'lookup' }], ordering: 'strict' },
    },
  ],
};

describe('Conversation replay through existing experiment APIs', () => {
  let llm: LLMock;
  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });
  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });
  afterAll(async () => {
    await llm.stop();
  });

  async function fixture(withMemory = true) {
    const storage = new InMemoryStore();
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 100,
        workingMemory: { enabled: true, scope: 'resource', template: '# Customer', useStateSignals: true },
      },
    });
    const live: unknown[] = [];
    const model = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini');
    const agent = new Agent({
      id: 'support',
      name: 'Support',
      model,
      errorProcessors: [],
      instructions: ({ requestContext }) => `Support ${requestContext.get('variant') ?? 'default'}`,
      ...(withMemory ? { memory } : {}),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Read an order',
          inputSchema: z.object({ id: z.number() }),
          execute: async args => {
            live.push(args);
            return { status: 'live' };
          },
        }),
      },
    });
    const answer = createScorer({ id: 'answer', name: 'Answer', type: 'agent' }).generateScore(({ run }) => {
      const text = run.output
        ?.flatMap(message => message.content.parts)
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
      return text === run.groundTruth ? 1 : 0;
    });
    const trajectory = createTrajectoryAccuracyScorerCode({ comparisonOptions: { ordering: 'strict' } });
    const mastra = new Mastra({ agents: { support: agent }, scorers: { answer, trajectory }, storage, logger: false });
    const dataset = await mastra.datasets.create({ name: 'Conversation' });
    return { storage, memory, live, agent, answer, trajectory, mastra, dataset };
  }

  function script() {
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'first', name: 'lookup', arguments: { id: 42 } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Candidate one' });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 2 },
      { toolCalls: [{ id: 'second', name: 'lookup', arguments: { id: 42 } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Candidate two' });
  }

  for (const path of ['experiment', 'run-item'] as const) {
    it(`${path}: carries only candidate history, scopes identical tools per turn, and persists one score per scorer`, async () => {
      const { dataset, storage, live, answer, trajectory, mastra } = await fixture();
      const item = await dataset.addItem({ input, memorySeed: { workingMemory: '# Customer\nAda' } });
      script();
      const scorerIds = [answer.id, trajectory.id];
      const agentModel = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o');
      const run =
        path === 'experiment'
          ? await runExperiment(mastra, {
              datasetId: dataset.id,
              targetType: 'agent',
              targetId: 'support',
              scorers: scorerIds,
              requestContext: { variant: 'candidate' },
              agentModel,
              unmockedToolPolicy: 'allow',
            })
          : await dataset.createExperiment({ targetType: 'agent', targetId: 'support', scorers: scorerIds });
      const result =
        'results' in run
          ? run.results[0]!
          : (
              await dataset.runExperimentItem({
                experimentId: run.experimentId,
                itemId: item.id,
                requestContext: { variant: 'candidate' },
              })
            ).result;
      expect(result.error).toBeNull();
      const output = result.output as AgentExperimentOutput;
      expect(output.turns?.map(turn => turn.output?.text)).toEqual(['Candidate one', 'Candidate two']);
      expect(output.turns?.map(turn => turn.scores.map(score => score.score))).toEqual([
        [1, 1],
        [1, 1],
      ]);
      expect(output.turns?.every(turn => turn.toolMockReport?.served.length === 1)).toBe(true);
      const requests = llm.getRequests();
      expect(requests).toHaveLength(4);
      expect(requests.every(request => request.body.model === (path === 'experiment' ? 'gpt-4o' : 'gpt-4o-mini'))).toBe(
        true,
      );
      const third = JSON.stringify(requests[2]!.body.messages);
      expect(third).toContain('Candidate one');
      expect(third.match(/Candidate one/g)).toHaveLength(1);
      expect(third).toContain('Second order');
      expect(third).toContain('first');
      expect(JSON.stringify(requests[3]!.body.messages)).toContain('second');
      expect(requests.every(request => JSON.stringify(request.body.messages).includes('Support candidate'))).toBe(true);
      expect(live).toEqual([]);
      const scores = await (await storage.getStore('scores'))!.listScoresByRunId({
        runId: run.experimentId,
        pagination: { page: 0, perPage: 100 },
      });
      expect(scores.scores).toHaveLength(2);
      expect(scores.scores.map(score => score.score)).toEqual([1, 1]);
      const persisted = await (await storage.getStore('experiments'))!.listExperimentResults({
        experimentId: run.experimentId,
        pagination: { page: 0, perPage: 100 },
      });
      expect(persisted.results).toHaveLength(1);
      expect(persisted.results[0]!.output).toMatchObject({ turns: output.turns });
    });
  }

  it('reveals a later regression caused by candidate memory instead of restoring the original turn seed', async () => {
    const { mastra, memory, answer } = await fixture();
    await memory.createThread({ threadId: 'production', resourceId: 'customer' });
    await memory.updateWorkingMemory({
      threadId: 'production',
      resourceId: 'customer',
      workingMemory: '# Customer\nAda',
    });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'memory', name: 'setWorkingMemory', arguments: { memory: '# Customer\nGrace' } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Remembered' });
    llm.on(
      { endpoint: 'chat', predicate: request => JSON.stringify(request.messages).includes('Grace') },
      { content: 'Grace' },
    );
    llm.on({ endpoint: 'chat' }, { content: 'Ada' });
    const replay: ConversationReplayInput = {
      type: 'conversation',
      turns: [
        { input: [user('Remember my name')], groundTruth: 'Remembered' },
        { input: [user('What is my name?')], groundTruth: 'Ada' },
      ],
    };
    const conversation = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      scorers: [answer],
      data: [{ input: replay, memorySeed: { workingMemory: '# Customer\nAda' } }],
    });
    const result = conversation.results[0]!;
    expect(result.error).toBeNull();
    const output = result.output as AgentExperimentOutput;
    expect(output.turns?.[1]?.workingMemoryBefore).toContain('Grace');
    expect(output.turns?.map(turn => turn.scores[0]?.score)).toEqual([1, 0]);
    expect(result.scores[0]!.score).toBe(0.5);
    expect(output.turns?.[1]?.workingMemoryBefore).toContain('Grace');
    expect(output.workingMemory).toContain('Grace');
    const isolated = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      scorers: [answer],
      data: [
        {
          input: replay.turns[1]!.input,
          groundTruth: 'Ada',
          memorySeed: { workingMemory: '# Customer\nAda' },
          toolMockMatchMode: 'lookup',
          unmockedToolPolicy: 'deny',
        },
      ],
    });
    expect(isolated.results[0]!.scores[0]!.score).toBe(1);
    expect(await memory.getWorkingMemory({ threadId: 'production', resourceId: 'customer' })).toBe('# Customer\nAda');
    expect(JSON.stringify(llm.getRequests().at(-1)!.body.messages)).not.toContain('Grace');
  });

  it('never serves a future turn recording or runs an unrecorded tool live', async () => {
    const { mastra, live } = await fixture();
    script();
    const replay = structuredClone(input);
    replay.turns[0]!.toolMocks = [];
    const run = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      unmockedToolPolicy: 'allow',
      toolMockMatchMode: 'ordered',
      data: [{ input: replay }],
    });
    const result = run.results[0]!;
    expect(result.error).toBeNull();
    const output = result.output as AgentExperimentOutput;
    expect(output.turns?.[0]?.toolMockReport?.misses).toMatchObject([{ toolName: 'lookup', reason: 'not-recorded' }]);
    expect(output.turns?.[1]?.toolMockReport?.served).toHaveLength(1);
    expect(result.toolMockReport?.misses).toHaveLength(1);
    expect(JSON.stringify(llm.getRequests()[1]!.body.messages)).not.toContain('"status":"second"');
    expect(live).toEqual([]);
  });

  it('retains completed evidence on a later failure and restarts retries with empty candidate history', async () => {
    const { mastra, answer } = await fixture();
    const replay: ConversationReplayInput = {
      type: 'conversation',
      turns: [
        { input: [user('First')], groundTruth: 'First answer' },
        { input: [user('Second')], groundTruth: 'Second answer' },
        { input: [user('Third')], groundTruth: 'Third answer' },
        { input: [user('Fourth')], groundTruth: 'Fourth answer' },
      ],
    };
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First answer' });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Second answer' });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 2 },
      { error: { message: 'Turn three failed', type: 'invalid_request_error' }, status: 400 },
    );
    const run = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      scorers: [answer],
      data: [{ input: replay }],
    });
    const result = run.results[0]!;
    expect(result.error?.message).toContain('Turn three failed');
    const output = result.output as AgentExperimentOutput;
    expect(output.turns).toHaveLength(3);
    expect(output.turns?.map(turn => turn.scores.length)).toEqual([1, 1, 0]);
    expect(output.text).toBe('Second answer');
    expect(result.scores[0]!.reason).toContain('2/4 turns scored');
    expect(llm.getRequests()).toHaveLength(3);

    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First attempt' });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      { error: { message: 'Retry the item', type: 'invalid_request_error' }, status: 400 },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Fresh first' });
    llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Fresh second' });
    const retried = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      maxRetries: 1,
      data: [{ input: { ...replay, turns: replay.turns.slice(0, 2) } }],
    });
    expect(retried.results[0]!.error).toBeNull();
    expect(retried.results[0]!.retryCount).toBe(1);
    expect(JSON.stringify(llm.getRequests()[2]!.body.messages)).not.toContain('First attempt');
    expect(JSON.stringify(llm.getRequests()[3]!.body.messages)).toContain('Fresh first');
  });

  it('preserves completed turns on cancellation and sends no remaining user inputs', async () => {
    const { mastra } = await fixture();
    const controller = new AbortController();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First answer' });
    llm.on(
      {
        endpoint: 'chat',
        predicate: request => {
          if (JSON.stringify(request.messages).includes('Second order'))
            controller.abort(new Error('Cancelled replay'));
          return true;
        },
      },
      { content: 'Late answer' },
    );
    const result = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      signal: controller.signal,
      maxRetries: 1,
      data: [{ input: { ...input, turns: [...input.turns, { input: [user('Never send this')] }] } }],
    });
    expect(result.results[0]!.error).not.toBeNull();
    const output = result.results[0]!.output as AgentExperimentOutput;
    expect(output.turns?.[0]?.output?.text).toBe('First answer');
    expect(output.turns?.[1]?.error?.message).toContain('Cancelled replay');
    expect(JSON.stringify(llm.getRequests())).not.toContain('Never send this');
  });

  it('keeps not-scorable and failed grading visible without inventing a numeric aggregate', async () => {
    const { mastra } = await fixture();
    const unscored = createScorer({ id: 'unscored', name: 'Unscored' })
      .preprocess(() => notScorable('Not applicable'))
      .generateScore(() => 1);
    const broken = createScorer({ id: 'broken', name: 'Broken' }).generateScore(() => {
      throw new Error('Judge unavailable');
    });
    llm.on({ endpoint: 'chat' }, { content: 'Answer' });
    const run = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: 'support',
      scorers: [unscored, broken],
      data: [{ input }],
    });
    expect(run.results[0]!.scores.map(score => score.score)).toEqual([null, null]);
    const output = run.results[0]!.output as AgentExperimentOutput;
    expect(output.turns?.[0]?.scores[0]?.notScorable?.reason).toBe('Not applicable');
    expect(output.turns?.[1]?.scores[1]?.error).toContain('Judge unavailable');
  });

  it.each([
    { groundTruth: 'ambiguous' },
    { toolMocks: [] },
    { expectedTrajectory: {} },
    { toolMockMatchMode: 'ordered' as const },
    { unmockedToolPolicy: 'allow' as const },
  ])('rejects incompatible item fields before model execution: %j', async fields => {
    const { mastra } = await fixture();
    const run = await runExperiment(mastra, { targetType: 'agent', targetId: 'support', data: [{ input, ...fields }] });
    expect(run.results[0]!.error).not.toBeNull();
    expect(llm.getRequests()).toEqual([]);
  });

  it('isolates concurrent conversations and repeated runs under fresh threads and resources', async () => {
    const { mastra, memory } = await fixture();
    llm.on({ endpoint: 'chat' }, { content: 'Candidate answer' });
    for (let repeat = 0; repeat < 2; repeat++) {
      const run = await runExperiment(mastra, {
        targetType: 'agent',
        targetId: 'support',
        maxConcurrency: 2,
        data: ['Alpha', 'Beta'].map(name => ({ input, memorySeed: { workingMemory: `# Customer\n${name}` } })),
      });
      expect(run.succeededCount).toBe(2);
    }
    const requests = llm.getRequests();
    expect(requests).toHaveLength(8);
    const threadIds = new Set(requests.map(request => request.headers['x-thread-id']));
    const resources = new Set(requests.map(request => request.headers['x-resource-id']));
    expect(threadIds.size).toBe(4);
    expect(resources.size).toBe(4);
    for (const request of requests) {
      const prompt = JSON.stringify(request.body.messages);
      expect(prompt.includes('Alpha') && prompt.includes('Beta')).toBe(false);
      const earlier = request.body.messages.filter(message => message.role === 'assistant');
      expect(earlier.length).toBeLessThanOrEqual(1);
    }
    expect((await (await memory.storage.getStore('memory'))!.listThreads({ perPage: false })).threads).toHaveLength(4);
  });

  it('round trips the conversation through a dataset snapshot and replays its own frozen references', async () => {
    const { dataset, mastra } = await fixture();
    const item = await dataset.addItem({
      input,
      memorySeed: { workingMemory: '# Customer\nAda' },
      toolMockMatchMode: 'lookup',
      unmockedToolPolicy: 'deny',
      source: { type: 'thread', referenceId: 'production' },
    });
    const snapshot = createDatasetSnapshot({
      formatVersion: 1,
      datasetIdentity: dataset.id,
      configuration: { name: 'Conversation' },
      items: [
        {
          itemIdentity: item.id,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          payload: {
            input: item.input,
            memorySeed: item.memorySeed,
            toolMockMatchMode: item.toolMockMatchMode,
            unmockedToolPolicy: item.unmockedToolPolicy,
            source: item.source,
          },
        },
      ],
      provenance: {
        exportedAt: new Date().toISOString(),
        sourceDatasetId: dataset.id,
        itemVersion: 1,
        configurationBasis: 'export-time',
      },
    });
    const parsed = parseDatasetSnapshot(JSON.stringify(snapshot));
    expect(parsed.items[0]!.payload.input).toEqual(input);
    const copy = await mastra.datasets.create(parsed.configuration);
    await copy.addItem(parsed.items[0]!.payload);
    script();
    const run = await copy.startExperiment({ targetType: 'agent', targetId: 'support', scorers: ['answer'] });
    expect(run.results[0]!.error).toBeNull();
    expect(run.results[0]!.scores[0]!.score).toBe(1);
    const output = run.results[0]!.output as AgentExperimentOutput;
    expect(output.turns?.[0]?.groundTruth).toBe('Candidate one');
    const copiedItem = (await copy.listItems({ perPage: 10 })).items[0]!;
    await copy.updateItem({ id: copiedItem.id, input: 'Edited after execution' });
    const saved = await (await mastra.getStorage()!.getStore('experiments'))!.listExperimentResults({
      experimentId: run.experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(saved.results[0]!.output).toMatchObject({
      turns: [{ groundTruth: 'Candidate one' }, { groundTruth: 'Candidate two' }],
    });
  });

  it('leaves inline tasks free to use conversation-shaped JSON', async () => {
    const { mastra } = await fixture(false);
    const run = await runExperiment(mastra, { data: [{ input }], task: ({ input }) => input });
    expect(run.results[0]!.error).toBeNull();
    expect(run.results[0]!.output).toEqual(input);
    expect(llm.getRequests()).toEqual([]);
  });

  it('requires memory before making any model request', async () => {
    const { mastra } = await fixture(false);
    const result = await runExperiment(mastra, { data: [{ input }], targetType: 'agent', targetId: 'support' });
    expect(result.results[0]!.error?.message).toContain('configured memory');
    expect(llm.getRequests()).toEqual([]);
  });

  it('previews and imports one conversation over real HTTP, retaining source turns and permissions', async () => {
    const { mastra, memory, dataset } = await fixture();
    await memory.createThread({ threadId: 'source', resourceId: 'customer' });
    const store = (await memory.storage.getStore('memory'))!;
    const messages: MastraDBMessage[] = input.turns.flatMap((turn, index) => [
      {
        ...turn.input[0]!,
        createdAt: new Date(index * 2000),
        id: `user-${index}`,
        threadId: 'source',
        resourceId: 'customer',
      },
      {
        role: 'assistant',
        id: `answer-${index}`,
        createdAt: new Date(index * 2000 + 1000),
        threadId: 'source',
        resourceId: 'customer',
        content: { format: 2, parts: [{ type: 'text', text: `Original answer ${index}` }] },
      },
    ]);
    await store.saveMessages({ messages });
    const storedBefore = await store.listMessages({ threadId: 'source', perPage: false });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const request = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    try {
      const source = { agentId: 'support', threadId: 'source', resourceId: 'customer', mode: 'conversation' };
      const preview = await request('/datasets/replay/preview', source);
      expect(preview.status).toBe(200);
      expect(await preview.json()).toEqual({ turnCount: 2 });
      const imported = await request(`/datasets/${dataset.id}/items/from-thread`, source);
      expect(imported.status).toBe(200);
      expect(await imported.json()).toEqual({ turnCount: 2, itemIds: [expect.any(String)] });
      const items = await dataset.listItems({ perPage: 10 });
      expect(items.items).toHaveLength(1);
      expect(items.items[0]!.input).toMatchObject({
        type: 'conversation',
        turns: [
          { input: [user('First order')], groundTruth: 'Original answer 0' },
          { input: [user('Second order')], groundTruth: 'Original answer 1' },
        ].map(turn => ({ ...turn, input: turn.input.map(({ createdAt: _, ...message }) => message) })),
      });
      expect((await request('/datasets/replay/preview', { ...source, historyLimit: 0 })).status).toBe(400);
      expect((await request('/datasets/replay/preview', { ...source, resourceId: 'wrong' })).status).toBe(403);
      expect(await store.listMessages({ threadId: 'source', perPage: false })).toEqual(storedBefore);
      expect(await datasetItemsFromThread({ memory, threadId: 'source' })).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  });
});
