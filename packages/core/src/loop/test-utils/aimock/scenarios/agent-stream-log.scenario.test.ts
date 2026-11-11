/**
 * AIMock Scenario: what a run keeps on its stream log (`agent.stream.<runId>`)
 *
 * Every event a run publishes is kept on its topic so `observe()` and
 * reconnecting clients can replay it, which on Redis means it is stored. The
 * log has to stay proportional to what the run produced, not to steps times
 * prompt size, and a replay has to show readers the same steps the caller saw.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../../../../agent/streams/constants';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { CachingPubSub } from '../../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createTool } from '../../../../tools';
import type { OutputProcessor } from '../../../../processors';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

const PROMPT_MARKER = 'PROMPT-MARKER-7f3c';
const WRITER_MARKER = 'WRITER-INSTRUCTIONS-91ad';
/** Enough steps that producers resend the whole response list mid-run. */
const TOOL_STEPS = 9;

/** A bus that, like Redis, only ever hands readers JSON copies of what was published. */
class JsonPubSub extends EventEmitterPubSub {
  override publish(...[topic, event, options]: Parameters<EventEmitterPubSub['publish']>) {
    return super.publish(topic, JSON.parse(JSON.stringify(event)), options);
  }
}

/** A replay cache that, like Redis, stores JSON copies of what was published. */
class JsonCache extends InMemoryServerCache {
  override listPushIndexed(...[listKey, counterKey, value, ttlMs]: Parameters<InMemoryServerCache['listPushIndexed']>) {
    return super.listPushIndexed(listKey, counterKey, JSON.parse(JSON.stringify(value)), ttlMs);
  }
}

/** The bus a run's events are published on: a plain agent's stream bus, else the durable agent's pubsub. */
const runBus = (agent: any) => agent.__getStreamBus?.()?.pubsub ?? agent.pubsub;

const lookup = createTool({
  id: 'lookup',
  description: 'Look something up.',
  inputSchema: z.object({ q: z.string() }),
  execute: async ({ q }) => ({ value: `RESULT-${q}` }),
});

/** Tool calls `call_0` .. `call_{n-1}`, each made after the previous result, then a text answer. */
function scriptToolLoop(llm: any) {
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: { q: '0' } }] },
  );
  for (let i = 1; i < TOOL_STEPS; i++) {
    llm.on(
      { endpoint: 'chat', toolCallId: `call_${i - 1}`, hasToolResult: true },
      { toolCalls: [{ id: `call_${i}`, name: 'lookup', arguments: { q: String(i) } }] },
    );
  }
  llm.on(
    { endpoint: 'chat', toolCallId: `call_${TOOL_STEPS - 1}`, hasToolResult: true },
    { content: 'All done.', reasoning: 'Every lookup came back.' },
  );
}

async function waitForTerminal(bus: any, runId: string) {
  const topic = AGENT_STREAM_TOPIC(runId);
  let history: any[] = [];
  await vi.waitFor(async () => {
    history = await bus.getHistory(topic);
    expect(history.some(event => event.type === AgentStreamEventTypes.FINISH)).toBe(true);
  });
  return history;
}

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** The parts of a step result a reader relies on, as plain JSON. */
const stepView = (step: any) =>
  JSON.parse(
    JSON.stringify({
      finishReason: step.finishReason,
      usage: step.usage,
      text: step.text,
      content: step.content,
      responseMessages: step.response?.messages,
      tripwire: step.tripwire ?? null,
      reasoningText: step.reasoningText ?? null,
    }),
  );

describeForAllEngines('AIMock loop scenario: what a run keeps on its stream log', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: a plain Agent published the loop's in-process chunks as-is, so every step-start and
  // step-finish carried the whole prompt (`request`, `metadata.request`, `messages`) and every
  // earlier step with its own prompt (`output.steps`). Long runs filled Redis with GBs per run.
  it('keeps one copy of the prompt on the log, however many steps the run takes', async () => {
    const llm = getMock();
    scriptToolLoop(llm);
    const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { lookup } });
    const run: any = await agent.stream(`${PROMPT_MARKER} ${'Look this up carefully. '.repeat(200)}`, {
      maxSteps: 12,
    });
    try {
      const output = run.output ?? run;
      await output.consumeStream();
      expect(await output.text).toBe('All done.');

      const history = await waitForTerminal(runBus(agent), run.runId);
      const log = JSON.stringify(history);
      expect(history.filter(event => event.data?.type === 'step-finish')).toHaveLength(TOOL_STEPS + 1);
      // The finish event carries the conversation once (`messages.all` and `messages.user`).
      expect(occurrences(log, PROMPT_MARKER)).toBeLessThanOrEqual(2);
    } finally {
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);

  // Technical: every step-finish carried the run's response messages so far, so the first tool's
  // output was stored once per later step. Step-finish events now send only what changed.
  it('stores an early tool result about as often as the last one', async () => {
    const llm = getMock();
    scriptToolLoop(llm);
    const { agent, mastra } = await createSharedAgent(llm, {
      engine,
      tools: { lookup },
      ...(engine === 'inngest' ? {} : { pubsub: new JsonPubSub(), cache: new JsonCache() }),
    });
    const run: any = await agent.stream('Look it all up.', { maxSteps: 12 });
    try {
      await (run.output ?? run).consumeStream();
      const history = await waitForTerminal(runBus(agent), run.runId);
      const log = JSON.stringify(history);
      const first = occurrences(log, 'RESULT-0');
      const last = occurrences(log, `RESULT-${TOOL_STEPS - 1}`);
      // A whole list resent before the last tool's step repeats the first result only. The producer
      // resends it once the diffs since the previous one add up to its size.
      const stepFinishes = history.filter(event => event.data?.type === 'step-finish');
      const resentBeforeLast = stepFinishes
        .slice(1, TOOL_STEPS - 1)
        .filter(event => event.data.payload._durableResponseMessagesDiff?.from === 0).length;
      if (engine === 'inngest') {
        // Known gap: the Inngest durable agent still sends the whole list on every step.
        expect(first).toBeGreaterThan(last + 2);
      } else {
        expect(resentBeforeLast).toBeLessThanOrEqual(3);
        expect(first).toBe(last + resentBeforeLast);
      }
    } finally {
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);

  // Technical: approving a suspended tool call resumes the run in a new publisher on the same
  // topic, which numbers its diffs from scratch and starts with the whole list.
  it('replays the response messages of a run suspended for approval and resumed', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_approve', name: 'lookup', arguments: { q: 'approved' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved and done.' });
    const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { lookup } });
    const run: any = await agent.stream('Look it up.', { requireToolApproval: true, maxSteps: 5 });
    let resumed: any;
    try {
      let toolCallId: string | undefined;
      for await (const chunk of run.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
          break;
        }
      }
      resumed = await agent.approveToolCall({ runId: run.runId, toolCallId: toolCallId! });
      const resumedOutput = resumed.output ?? resumed;
      await resumedOutput.consumeStream();
      expect(await resumedOutput.text).toBe('Approved and done.');
      const liveSteps = JSON.parse(
        JSON.stringify((await resumedOutput.steps).map((step: any) => step.response.messages)),
      );
      const liveMessages = liveSteps.at(-1);
      await waitForTerminal(runBus(agent), run.runId);

      const observed: any[] = [];
      const observation: any = await agent.observe(run.runId, {
        onStepFinish: (step: any) => {
          observed.push(step);
        },
      });
      for await (const _chunk of observation.fullStream) {
        // drain
      }
      expect(JSON.stringify(liveMessages)).toContain('RESULT-approved');
      expect(observed.slice(-liveSteps.length).map(step => step.response.messages)).toEqual(liveSteps);
    } finally {
      resumed?.cleanup?.();
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);

  // Technical: an observer that starts at an offset skips the step-finish events that carried the
  // earlier response messages; it rebuilds them from the run's log before following it.
  it('gives an observer resuming mid-run the full response messages of each step', async () => {
    const llm = getMock();
    scriptToolLoop(llm);
    const { agent, mastra } = await createSharedAgent(llm, {
      engine,
      tools: { lookup },
      ...(engine === 'inngest' ? {} : { pubsub: new JsonPubSub(), cache: new JsonCache() }),
    });
    const live: any[] = [];
    const run: any = await agent.stream('Look it all up.', {
      maxSteps: 12,
      onStepFinish: (step: any) => {
        live.push(step);
      },
    });
    try {
      await (run.output ?? run).consumeStream();
      const history = await waitForTerminal(runBus(agent), run.runId);
      const stepFinishes = history.filter(event => event.data?.type === 'step-finish');
      const offset = stepFinishes[2].index + 1;

      const observed: any[] = [];
      const observation: any = await agent.observe(run.runId, {
        offset,
        onStepFinish: (step: any) => {
          observed.push(step);
        },
      });
      for await (const _chunk of observation.fullStream) {
        // drain
      }

      expect(observed.map(step => step.response.messages)).toEqual(
        live.slice(3).map(step => JSON.parse(JSON.stringify(step.response.messages))),
      );
      expect(JSON.stringify(observed.at(-1).response.messages)).toContain('RESULT-0');
    } finally {
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);

  // Technical: on a bus that keeps no history of the run's topic, an observer that attaches mid-run
  // has none of the earlier step-finishes, so it can't place a diff made against them. Producers
  // send such a bus whole lists. A CachingPubSub supports offsets even for the topics it doesn't
  // cache, so producers ask the bus about the topic.
  // The Inngest engine runs on its own bus.
  (engine === 'inngest' ? it.skip : it).each(['replay turned off', 'a cache that leaves the topic out'] as const)(
    'gives an observer that joins mid-run with %s the full response messages of each step',
    async bus => {
      const llm = getMock();
      scriptToolLoop(llm);
      let reachedMidRun!: () => void;
      const midRun = new Promise<void>(resolve => (reachedMidRun = resolve));
      let attach!: () => void;
      const attached = new Promise<void>(resolve => (attach = resolve));
      const pausingLookup = createTool({
        id: 'lookup',
        description: 'Look something up.',
        inputSchema: z.object({ q: z.string() }),
        execute: async ({ q }) => {
          if (q === '3') {
            reachedMidRun();
            await attached;
          }
          return { value: `RESULT-${q}` };
        },
      });
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        tools: { lookup: pausingLookup },
        ...(bus === 'replay turned off'
          ? { pubsub: new JsonPubSub(), streamReplay: false }
          : {
              pubsub: new CachingPubSub(new JsonPubSub(), new JsonCache(), {
                shouldCache: topic => !topic.startsWith(AGENT_STREAM_TOPIC('')),
              }),
            }),
      });
      const live: any[] = [];
      const run: any = await agent.stream('Look it all up.', {
        maxSteps: 12,
        onStepFinish: (step: any) => {
          live.push(step);
        },
      });
      try {
        const consumed = (run.output ?? run).consumeStream();
        await midRun;
        const observed: any[] = [];
        const observation: any = await agent.observe(run.runId, {
          onStepFinish: (step: any) => {
            observed.push(step);
          },
        });
        attach();
        for await (const _chunk of observation.fullStream) {
          // drain
        }
        await consumed;

        // Attached during the fourth step's tool call: it sees that step's step-finish and the rest.
        expect(observed).toHaveLength(TOOL_STEPS + 1 - 3);
        expect(observed.map(step => step.response.messages)).toEqual(
          live.slice(3).map(step => JSON.parse(JSON.stringify(step.response.messages))),
        );
        expect(JSON.stringify(observed[0].response.messages)).toContain('RESULT-0');
      } finally {
        run.cleanup?.();
        if (engine !== 'inngest') await mastra.shutdown();
      }
    },
    30_000,
  );

  // Technical: a delegated agent's chunks are forwarded inside `tool-output` chunks, and its own
  // step-start / step-finish / finish carried its prompt like the parent's did.
  // Durable engines still publish them as-is: their callers read their own run back from the
  // topic, so slimming there would change what the caller sees. Not yet fixed for them.
  // Tracked in #29035; this flips to `it` once durable engines slim delegated chunks.
  const itOnPlainAgents = isDurableEngineVariant(engine) ? it.fails : it;
  itOnPlainAgents(
    "keeps a delegated agent's prompt off the log",
    async () => {
      const llm = getMock();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const writer = new Agent({
        id: 'writer',
        name: 'Writer',
        description: 'Drafts written content',
        instructions: `${WRITER_MARKER} You are a skilled writer subagent.`,
        model: openai(SCENARIO_MODEL_ID),
      });
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Draft a coffee tagline.' } }] },
      );
      llm.onMessage(/coffee tagline/i, { content: 'Brewed fresh, served warm.' });
      llm.on({ endpoint: 'chat', toolCallId: 'call_writer', hasToolResult: true }, { content: 'Brewed fresh.' });
      const { agent, mastra } = await createSharedAgent(llm, { engine, agents: { writer } });
      const run: any = await agent.stream('Ask the writer for a tagline.', { maxSteps: 5 });
      try {
        const output = run.output ?? run;
        await output.consumeStream();
        expect(await output.text).toBe('Brewed fresh.');

        const log = JSON.stringify(await waitForTerminal(runBus(agent), run.runId));
        // The delegated run did stream through the parent.
        expect(log).toContain('Brewed fresh, served warm.');
        expect(occurrences(log, WRITER_MARKER)).toBe(0);
      } finally {
        run.cleanup?.();
        if (engine !== 'inngest') await mastra.shutdown();
      }
    },
    30_000,
  );

  // Technical: plain step-finish events had no `_durableStepContent`, so an observer built each
  // step's content from its own (empty) message list and replayed `content: []`. The finish
  // event's steps were the loop's step objects: `text` was lost over JSON, and an in-memory
  // observer's onFinish threw on their AI SDK-shaped `toolCalls`.
  it.each(['in-memory', 'JSON'] as const)(
    'replays the steps the caller saw to an observer, over a %s transport',
    async transport => {
      const llm = getMock();
      scriptToolLoop(llm);
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        tools: { lookup },
        ...(transport === 'JSON' && engine !== 'inngest' ? { pubsub: new JsonPubSub(), cache: new JsonCache() } : {}),
      });
      const live: any[] = [];
      const run: any = await agent.stream('Look it all up.', {
        maxSteps: 12,
        onStepFinish: (step: any) => {
          live.push(step);
        },
      });
      try {
        await (run.output ?? run).consumeStream();
        await waitForTerminal(runBus(agent), run.runId);

        const observed: any[] = [];
        let observedFinish: any;
        const observation: any = await agent.observe(run.runId, {
          onStepFinish: (step: any) => {
            observed.push(step);
          },
          onFinish: (result: any) => {
            observedFinish = result;
          },
        });
        for await (const _chunk of observation.fullStream) {
          // drain
        }
        await vi.waitFor(() => expect(observedFinish).toBeDefined());

        expect(live).toHaveLength(TOOL_STEPS + 1);
        expect(observed.map(stepView)).toEqual(live.map(stepView));
        // Each tool step's content holds its own call and result.
        expect(JSON.stringify(observed[2].content)).toContain('RESULT-2');
        // The provider request stays with the caller; observers never get it. DurableAgent callers
        // read their run back from the topic too, so only a plain Agent's caller sees it per step.
        if (!isDurableEngineVariant(engine)) expect(live.every(step => step.request?.body)).toBe(true);
        expect(observed.every(step => step.request?.body === undefined)).toBe(true);
        expect(observedFinish.text).toBe('All done.');
        expect(observedFinish.steps).toHaveLength(TOOL_STEPS + 1);
        expect(observedFinish.toolCalls).toHaveLength(TOOL_STEPS);
        expect(observedFinish.steps.at(-1).reasoningText).toBe('Every lookup came back.');
      } finally {
        run.cleanup?.();
        if (engine !== 'inngest') await mastra.shutdown();
      }
    },
    30_000,
  );

  // Technical: readers tell a rejected step by the tripwire on the last entry of the step-finish
  // `output.steps`; the published step-finish keeps only that entry.
  it('replays a rejected and retried reply to an observer the way the caller saw it', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'REJECTED draft that must not be shown' });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Corrected reply.' });
    const rejectFirstDraft: OutputProcessor = {
      id: 'reject-first-draft',
      processOutputStep: async ({ abort, retryCount, messageList }) => {
        if (retryCount === 0) abort('Draft rejected, please regenerate', { retry: true });
        return messageList;
      },
    };
    const { agent, mastra } = await createSharedAgent(llm, { engine });
    const live: any[] = [];
    const run: any = await agent.stream('Answer briefly.', {
      maxSteps: 5,
      maxProcessorRetries: 2,
      outputProcessors: [rejectFirstDraft],
      onStepFinish: (step: any) => {
        live.push(step);
      },
    });
    try {
      const output = run.output ?? run;
      await output.consumeStream();
      expect(await output.text).toBe('Corrected reply.');
      await waitForTerminal(runBus(agent), run.runId);

      const observed: any[] = [];
      let observedFinish: any;
      const observation: any = await agent.observe(run.runId, {
        onStepFinish: (step: any) => {
          observed.push(step);
        },
        onFinish: (result: any) => {
          observedFinish = result;
        },
      });
      for await (const _chunk of observation.fullStream) {
        // drain
      }
      await vi.waitFor(() => expect(observedFinish).toBeDefined());

      expect(observed.map(stepView)).toEqual(live.map(stepView));
      expect(observed[0].tripwire?.reason).toBe('Draft rejected, please regenerate');
      expect(observed[0].text).toBe('');
      expect(observedFinish.text).toBe('Corrected reply.');
    } finally {
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);
});
