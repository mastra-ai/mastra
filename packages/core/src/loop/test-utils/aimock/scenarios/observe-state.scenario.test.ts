import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { DurableAgent, EventedAgent } from '../../../../agent/durable';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../../events';
import { CachingPubSub } from '../../../../events/caching-pubsub';
import type { PubSub } from '../../../../events/pubsub';
import { Mastra } from '../../../../mastra';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

// These fixtures construct local core wrappers; Inngest needs its own worker host.
// Plain and filesystem agents do not expose observe(). No private registry mutation.
describeForAllEngines(
  'AIMock loop scenario: observer ownership and state',
  engine => {
    const getMock = useLoopScenarioAimock();
    const wrap = (agent: Agent, pubsub: PubSub) =>
      engine === 'evented' ? new EventedAgent({ agent, pubsub }) : new DurableAgent({ agent, pubsub });
    const model = () => createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` })(SCENARIO_MODEL_ID);

    // #27353: a foreign wrapper on the SAME host must not expose the live transcript.
    it('rejects a foreign live observer without breaking the owning observer', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_hold', name: 'hold', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Private owner answer.' });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const pubsub = new EventEmitterPubSub();
      const producer = wrap(
        new Agent({
          id: `live-owner-${engine}`,
          name: 'Owner',
          instructions: 'Answer privately.',
          model: model(),
          tools: {
            hold: createTool({
              id: 'hold',
              description: 'Wait for permission.',
              inputSchema: z.object({}),
              execute: async () => {
                entered.resolve();
                await release.promise;
                return { permitted: true };
              },
            }),
          },
        }),
        pubsub,
      );
      const foreign = wrap(
        new Agent({ id: `foreign-${engine}`, name: 'Foreign', instructions: 'Do not run.', model: model() }),
        pubsub,
      );
      const mastra = new Mastra({ agents: { producer, foreign }, pubsub, storage: new InMemoryStore(), logger: false });
      const run = await producer.stream('Private owner prompt', { maxSteps: 3, returnScorerData: true });
      const consuming = run.output.getFullOutput();
      let observation: Awaited<ReturnType<typeof producer.observe>> | undefined;
      let unexpected: Awaited<ReturnType<typeof foreign.observe>> | undefined;
      try {
        await entered.promise;
        await expect(foreign.observe(run.runId).then(result => (unexpected = result))).rejects.toMatchObject({
          id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
          details: { runId: run.runId, ownerAgentId: producer.id },
        });
        expect(unexpected).toBeUndefined();
        observation = await producer.observe(run.runId);
        const observed = observation.output.getFullOutput();
        release.resolve();
        const [original, replay] = await Promise.all([consuming, observed]);
        expect(original.text).toBe('Private owner answer.');
        expect(replay.text).toBe('Private owner answer.');
        expect(JSON.stringify(replay.scoringData?.input.inputMessages)).toContain('Private owner prompt');
        expect(JSON.stringify(replay.scoringData?.output)).toContain('Private owner answer.');
        expect(llm.getRequests()).toHaveLength(2);
      } finally {
        release.resolve();
        unexpected?.detach();
        observation?.detach();
        await consuming;
        run.cleanup?.();
        await mastra.shutdown();
        await pubsub.close();
      }
    });

    // #26906: a fresh same-ID wrapper must reuse call-time processors/context, not defaults.
    it('preserves live call-time processors and scoring data on another wrapper', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_hold', name: 'hold', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Live observer answer.' });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const contexts: unknown[] = [];
      const defaults: string[] = [];
      const processor: Processor = {
        id: 'call-time',
        processOutputStream: ({ part, requestContext }) => {
          contexts.push(requestContext.get('tenantId'));
          return part;
        },
      };
      const base = new Agent({
        id: `shared-owner-${engine}`,
        name: 'Shared owner',
        instructions: 'Answer.',
        model: model(),
        outputProcessors: [
          {
            id: 'default',
            processOutputStream: ({ part }) => {
              defaults.push(part.type);
              return part;
            },
          },
        ],
        tools: {
          hold: createTool({
            id: 'hold',
            description: 'Wait.',
            inputSchema: z.object({}),
            execute: async () => {
              entered.resolve();
              await release.promise;
              return { ready: true };
            },
          }),
        },
      });
      const pubsub = new EventEmitterPubSub();
      const producer = wrap(base, pubsub);
      const mastra = new Mastra({ agents: { producer }, storage: new InMemoryStore(), pubsub, logger: false });
      const observer = wrap(base, pubsub);
      observer.__setMastra(mastra);
      const run = await producer.stream('Live observer prompt', {
        maxSteps: 3,
        outputProcessors: [processor],
        returnScorerData: true,
        requestContext: new RequestContext([['tenantId', 'live-tenant']]),
      });
      const consuming = run.output.getFullOutput();
      let observation: Awaited<ReturnType<typeof observer.observe>> | undefined;
      try {
        await entered.promise;
        contexts.length = 0;
        observation = await observer.observe(run.runId);
        const observed = observation.output.getFullOutput();
        // The producer is blocked, so replay alone must invoke the call-time processor.
        await expect.poll(() => contexts.length).toBeGreaterThan(0);
        expect(contexts.every(value => value === 'live-tenant')).toBe(true);
        expect(defaults).toEqual([]);
        release.resolve();
        const [, full] = await Promise.all([consuming, observed]);
        expect(full.text).toBe('Live observer answer.');
        expect(JSON.stringify(full.scoringData?.input.inputMessages)).toContain('Live observer prompt');
        expect(JSON.stringify(full.scoringData?.output)).toContain('Live observer answer.');
        expect(contexts.every(value => value === 'live-tenant')).toBe(true);
        expect(defaults).toEqual([]);
        expect(llm.getRequests()).toHaveLength(2);
      } finally {
        release.resolve();
        observation?.detach();
        await consuming;
        run.cleanup?.();
        await mastra.shutdown();
        await pubsub.close();
      }
    });

    // #26906: a different host cannot see the producer's live registry entry.
    // A real suspended snapshot must restore context, processors, and scoring I/O.
    const runColdObservation = async (assertFinalScoringData: boolean) => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_approve', name: 'lookup', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Persisted observer answer.' });
      const transport = new EventEmitterPubSub();
      const pubsub = new CachingPubSub(transport, new InMemoryServerCache());
      const storage = new InMemoryStore();
      const contexts: unknown[] = [];
      const tools = {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up status.',
          inputSchema: z.object({}),
          execute: async () => ({ status: 'ok' }),
        }),
      };
      const producer = wrap(
        new Agent({ id: `cold-owner-${engine}`, name: 'Producer', instructions: 'Answer.', model: model(), tools }),
        pubsub,
      );
      const host = new Mastra({ agents: { producer }, storage, pubsub, logger: false });
      const observer = wrap(
        new Agent({
          id: producer.id,
          name: 'Cold observer',
          instructions: 'Do not run.',
          model: model(),
          tools,
          defaultOptions: { requestContext: new RequestContext([['tenantId', 'observer-default']]) },
          outputProcessors: [
            {
              id: 'restored',
              processOutputStream: ({ part, requestContext }) => {
                contexts.push(requestContext.get('tenantId'));
                return part;
              },
            },
          ],
        }),
        pubsub,
      );
      const foreign = wrap(
        new Agent({ id: `cold-foreign-${engine}`, name: 'Foreign', instructions: 'Do not run.', model: model() }),
        pubsub,
      );
      const observerHost = new Mastra({ agents: { observer, foreign }, storage, pubsub, logger: false });
      const run = await producer.stream('Persisted observer prompt', {
        requireToolApproval: true,
        maxSteps: 3,
        returnScorerData: true,
        requestContext: new RequestContext([['tenantId', 'persisted-tenant']]),
      });
      for await (const chunk of run.output.fullStream) {
        if (chunk.type === 'tool-call-approval') break;
      }
      let observation: Awaited<ReturnType<typeof observer.observe>> | undefined;
      let unexpected: Awaited<ReturnType<typeof foreign.observe>> | undefined;
      let resumed: Awaited<ReturnType<typeof producer.approveToolCall>> | undefined;
      try {
        expect(llm.getRequests()).toHaveLength(1);
        await expect(foreign.observe(run.runId).then(result => (unexpected = result))).rejects.toMatchObject({
          id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
          details: { runId: run.runId, ownerAgentId: producer.id },
        });
        resumed = await producer.approveToolCall({ runId: run.runId, toolCallId: 'call_approve' });
        await resumed.consumeStream();
        // Reconnect after settlement so scoring reads the persisted terminal transcript,
        // not the suspended snapshot racing the producer's final snapshot write.
        observation = await observer.observe(run.runId);
        const full = await observation.output.getFullOutput();
        expect(contexts.length).toBeGreaterThan(0);
        expect(full.text).toBe('Persisted observer answer.');
        expect(JSON.stringify(full.scoringData?.input.inputMessages)).toContain('Persisted observer prompt');
        if (assertFinalScoringData) {
          expect(JSON.stringify(full.scoringData?.output)).toContain('Persisted observer answer.');
        }
        expect(contexts.every(value => value === 'persisted-tenant')).toBe(true);
        expect(llm.getRequests()).toHaveLength(2);
      } finally {
        unexpected?.detach();
        observation?.detach();
        resumed?.cleanup?.();
        run.cleanup?.();
        await observerHost.shutdown();
        await host.shutdown();
        await transport.close();
      }
    };

    it('restores persisted observer state on a fresh host and rejects foreign readers', async () => {
      await runColdObservation(false);
    }, 30_000);

    // The stored transcript can lag behind what the stream already showed (durable kept the
    // suspended one), so the observer keeps the streamed response messages.
    it('refreshes cold observer scoring output after an approval resume', async () => {
      await runColdObservation(true);
    }, 30_000);

    // A run that looks something up, then answers. Readers on `readerHost` report the
    // conversation the producer on `host` ran.
    const startLookupRun = (setup: (build: () => DurableAgent, pubsub: PubSub, storage: InMemoryStore) => unknown) => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { order: 'A-1' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Order A-1 has shipped.' });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const build = () =>
        wrap(
          new Agent({
            id: `lookup-${engine}`,
            name: 'Support',
            instructions: 'Answer.',
            model: model(),
            tools: {
              lookup: createTool({
                id: 'lookup',
                description: 'Look up an order.',
                inputSchema: z.object({ order: z.string() }),
                execute: async () => {
                  entered.resolve();
                  await release.promise;
                  return { status: 'shipped' };
                },
              }),
            },
          }),
          pubsub,
        );
      const transport = new EventEmitterPubSub();
      const pubsub = new CachingPubSub(transport, new InMemoryServerCache());
      const storage = new InMemoryStore();
      setup(build, pubsub, storage);
      return { llm, entered, release, transport };
    };
    // What each message says, without per-list bookkeeping (ids, timestamps).
    const conversation = (messages: MastraDBMessage[]) =>
      messages.map(message => ({
        role: message.role,
        parts: message.content.parts.flatMap(part => {
          if (part.type === 'text') return [{ type: part.type, text: part.text }];
          if (part.type !== 'tool-invocation') return [];
          const { toolName, args, state, result } = part.toolInvocation as typeof part.toolInvocation & {
            result?: unknown;
          };
          return [{ type: part.type, toolInvocation: { toolName, args, state, result } }];
        }),
      }));
    // A reader's list stamps each part it adds with its own `createdAt` (Mastra bookkeeping
    // carried in `providerOptions.mastra`), so only those differ from the producer's.
    const withoutPartStamps = (messages: unknown) =>
      JSON.parse(JSON.stringify(messages, (key, value) => (key === 'mastra' ? undefined : value)));

    // Technical: the cold observer rebuilt its transcript from storage on every step, which lags
    // the stream (durable writes the snapshot after step-finish) or names an earlier iteration
    // (evented). With running snapshots the final answer went missing. It now takes each step's
    // response messages from the stream.
    for (const persistRunning of [false, true]) {
      it(`reports the producer's messages to an observer on another host${persistRunning ? ' (running snapshots)' : ''}`, async () => {
        let host!: Mastra;
        let readerHost!: Mastra;
        let producer!: DurableAgent;
        let observer!: DurableAgent;
        const { llm, entered, release, transport } = startLookupRun((build, pubsub, storage) => {
          producer = build();
          observer = build();
          const recovery = persistRunning ? { recovery: { durableAgents: 'auto' as const } } : {};
          host = new Mastra({ agents: { producer }, storage, pubsub, logger: false, ...recovery });
          readerHost = new Mastra({ agents: { observer }, storage, pubsub, logger: false });
        });
        const finished = { producer: Promise.withResolvers<unknown>(), observer: Promise.withResolvers<unknown>() };
        const run = await producer.stream('Where is order A-1?', {
          maxSteps: 3,
          onFinish: event => finished.producer.resolve(event.messages),
        });
        const consuming = run.output.getFullOutput();
        let observation: Awaited<ReturnType<typeof observer.observe>> | undefined;
        try {
          await entered.promise;
          observation = await observer.observe(run.runId, {
            onFinish: event => finished.observer.resolve(event.messages),
          });
          const observed = observation.output.getFullOutput();
          release.resolve();
          const [original, replay] = await Promise.all([consuming, observed]);
          expect(replay.text).toBe('Order A-1 has shipped.');
          const producerMessages = await finished.producer.promise;
          expect(producerMessages).toMatchObject([
            { role: 'assistant', content: [{ type: 'tool-call', toolName: 'lookup' }] },
            { role: 'tool', content: [{ type: 'tool-result', output: { value: { status: 'shipped' } } }] },
            { role: 'assistant', content: [{ type: 'text', text: 'Order A-1 has shipped.' }] },
          ]);
          expect(withoutPartStamps(await finished.observer.promise)).toEqual(withoutPartStamps(producerMessages));
          expect(conversation(replay.messages)).toEqual(conversation(original.messages));
          expect(llm.getRequests()).toHaveLength(2);
        } finally {
          release.resolve();
          observation?.detach();
          await consuming;
          run.cleanup?.();
          await readerHost.shutdown();
          await host.shutdown();
          await transport.close();
        }
      }, 30_000);
    }

    // Technical: an API host with `workers: false` runs a run its workers execute. Its
    // MessageList is the one it prepared, which no step updates, so onFinish and output
    // messages held only the prompt (evented). It now takes them from the stream.
    it.each(['stream', 'generate'] as const)(
      'reports the messages of a run executed by workers on another host (%s)',
      async method => {
        let api!: Mastra;
        let worker!: Mastra;
        let apiAgent!: DurableAgent;
        const { llm, release, transport } = startLookupRun((build, pubsub, storage) => {
          apiAgent = build();
          api = new Mastra({ agents: { apiAgent }, storage, pubsub, workers: false, logger: false });
          worker = new Mastra({ agents: { workerAgent: build() }, storage, pubsub, logger: false });
        });
        release.resolve();
        try {
          await worker.startWorkers();
          const finished = Promise.withResolvers<unknown>();
          const options = { maxSteps: 3, onFinish: (event: { messages: unknown }) => finished.resolve(event.messages) };
          let full: Awaited<ReturnType<typeof apiAgent.generate>>;
          if (method === 'generate') {
            full = await apiAgent.generate('Where is order A-1?', options);
          } else {
            const run = await apiAgent.stream('Where is order A-1?', options);
            full = await run.output.getFullOutput();
            run.cleanup?.();
          }
          expect(full.text).toBe('Order A-1 has shipped.');
          const expected = [
            { role: 'assistant', content: [{ type: 'tool-call', toolName: 'lookup' }] },
            { role: 'tool', content: [{ type: 'tool-result', output: { value: { status: 'shipped' } } }] },
            { role: 'assistant', content: [{ type: 'text', text: 'Order A-1 has shipped.' }] },
          ];
          expect(await finished.promise).toMatchObject(expected);
          expect(full.response.messages).toMatchObject(expected);
          expect(conversation(full.messages)).toMatchObject([
            { role: 'user', parts: [{ type: 'text', text: 'Where is order A-1?' }] },
            {
              role: 'assistant',
              parts: [
                { type: 'tool-invocation', toolInvocation: { toolName: 'lookup', result: { status: 'shipped' } } },
                { type: 'text', text: 'Order A-1 has shipped.' },
              ],
            },
          ]);
          expect(llm.getRequests()).toHaveLength(2);
        } finally {
          await api.shutdown();
          await worker.shutdown();
          await transport.close();
        }
      },
      30_000,
    );
  },
  { skip: ['normal', 'fs', 'inngest'] },
);
