import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../../events';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

function gate() {
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>(resolve => {
    entered = resolve;
  });
  const waiting = new Promise<void>(resolve => {
    release = resolve;
  });
  let aborted = false;
  return {
    ready,
    release,
    get aborted() {
      return aborted;
    },
    tool: createTool({
      id: 'wait',
      description: 'Wait.',
      inputSchema: z.object({}),
      execute: async (_, context) => {
        const signal = context!.abortSignal!;
        if (signal.aborted) aborted = true;
        else
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
            },
            { once: true },
          );
        entered();
        await waiting;
        return { done: true };
      },
    }),
  };
}

// #29487: separate agents can legitimately use the same caller-supplied run id.
describeForAllEngines('AIMock: agent run topic isolation', engine => {
  const getMock = useLoopScenarioAimock();
  // Concurrent evented hosts sharing the workflow bus reach undefined initData
  // before these assertions, including on baseline ccde1973. These expected
  // failures are not transport-isolation proof.
  // Inngest also fails before isolation assertions: fullStream accesses #options
  // through a Proxy receiver. Reproduced against the real dev server.
  const test = engine === 'evented' || engine === 'inngest' ? it.fails : it;
  test.each(['stream', 'generate'] as const)(
    'observing a concurrent %s run never receives another agent’s answer',
    async method => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'wait-call', name: 'wait', arguments: {} }] },
      );
      llm.on(
        { endpoint: 'chat', hasToolResult: true, predicate: req => JSON.stringify(req.messages).includes('Agent A') },
        { content: 'Private answer for agent A.' },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Public answer for agent B.' });
      const pubsub = new EventEmitterPubSub();
      const ga = gate();
      const gb = gate();
      const a = await createSharedAgent(llm, { engine, pubsub, streams: true, tools: { wait: ga.tool } });
      const b = await createSharedAgent(llm, { engine, pubsub, streams: true, tools: { wait: gb.tool } });
      const runId = 'same-conversation';
      const drain = async (result: any) => {
        if (method === 'generate') return result;
        for await (const _chunk of result.fullStream) {
          /* drain */
        }
      };
      const runningA = a.agent[method]('Agent A: Wait then answer.', { runId }).then(drain);
      let runningB: Promise<unknown> | undefined;
      let observation: Awaited<ReturnType<typeof b.agent.observe>> | undefined;
      try {
        await Promise.race([ga.ready, runningA]);
        runningB = b.agent[method]('Agent B: Wait then answer.', { runId }).then(drain);
        await Promise.race([gb.ready, runningB]);
        observation = await b.agent.observe(runId);
        const stream = observation.fullStream;
        const observed = (async () => {
          let text = '';
          for await (const chunk of stream) {
            if (chunk.type === 'text-delta') text += chunk.payload.text;
          }
          return text;
        })();
        ga.release();
        await runningA;
        gb.release();
        await runningB;
        expect(await observed).toBe('Public answer for agent B.');
      } finally {
        ga.release();
        gb.release();
        observation?.detach();
        await Promise.allSettled([runningA, runningB]);
        if (engine !== 'inngest') {
          await a.mastra.shutdown({ drainTimeout: 1000 });
          await b.mastra.shutdown({ drainTimeout: 1000 });
        }
      }
    },
    15000,
  );

  test('aborting one agent does not cancel a sibling using the same run id', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [{ id: 'wait-call', name: 'wait', arguments: {} }],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Sibling completed.' });
    const pubsub = new EventEmitterPubSub();
    const ga = gate();
    const gb = gate();
    const a = await createSharedAgent(llm, { engine, pubsub, streams: true, tools: { wait: ga.tool } });
    const b = await createSharedAgent(llm, { engine, pubsub, streams: true, tools: { wait: gb.tool } });
    const runId = 'same-abort-conversation';
    const collect = async (result: any) => {
      let text = '';
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      return text;
    };
    const runningA = a.agent.stream('Agent A: Wait.', { runId }).then(collect);
    let runningB: Promise<string> | undefined;
    try {
      await Promise.race([ga.ready, runningA]);
      runningB = b.agent.stream('Agent B: Wait.', { runId }).then(collect);
      await Promise.race([gb.ready, runningB]);
      a.agent.abortRunStream(runId);
      await expect.poll(() => ga.aborted).toBe(true);
      expect(gb.aborted).toBe(false);
      ga.release();
      await runningA;
      expect(gb.aborted).toBe(false);
      gb.release();
      expect(await runningB).toBe('Sibling completed.');
    } finally {
      ga.release();
      gb.release();
      await Promise.allSettled([runningA, runningB]);
      if (engine !== 'inngest') {
        await a.mastra.shutdown({ drainTimeout: 1000 });
        await b.mastra.shutdown({ drainTimeout: 1000 });
      }
    }
  }, 15000);
});
