import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../../packages/memory/src';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression (#24224): with observational memory enabled the loop builder read
 * this run's response from the *live* response set, which observational memory
 * prunes as it works — the per-step save drains the buckets, and a sealed async
 * buffer chunk leaves the set as well. Content the loop had already counted then
 * dropped out of the view it kept a running offset into, so `stopWhen` (and
 * `processInputStep`) saw an empty `content`/`toolResults` on a later tool step.
 * A predicate that stops on a tool result never fired and the run carried on to
 * its step cap, doing the extra model and tool work the issue reports.
 *
 * The loop must read the run's response from the persisted view, which keeps
 * every message the run produced (#25538).
 */

const echoTool = createTool({
  id: 'echoTool',
  description: 'Echoes the input string.',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async ({ input }) => ({ output: input }),
});

type CapturedStep = { contentLength: number; toolResultIds: string[] };

function toolResultIds(step: { toolResults?: Array<{ toolCallId?: string }> } | undefined) {
  return (step?.toolResults ?? []).map(result => result.toolCallId ?? '');
}

describeForAllEngines('AIMock loop scenario: observational memory keeps step content for stopWhen', engine => {
  const getMock = useLoopScenarioAimock();

  it("hands stopWhen the second tool step's results and stops before another model call", async () => {
    const llm = getMock();
    const observerModel = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` }).chat('observer-model');
    // The buffering interval is what routes the response message through OM's seal
    // path on the second step, so it leaves the live response set without a
    // blocking observation re-promoting it — the shape the offset bug hid behind.
    // `messageTokens` stays above what this run reaches, so no synchronous
    // observation (and no blocking observer call) happens mid-run.
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: observerModel,
            messageTokens: 200,
            bufferTokens: 40,
            maxRetries: 0,
          },
          reflection: { model: observerModel, observationTokens: 50_000 },
        },
      },
    });

    const captured: CapturedStep[] = [];
    const { requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Echo "first", then echo "second".',
      tools: { echoTool },
      memory,
      threadId: `om-stop-when-${engine}`,
      resourceId: 'resource-om-stop-when',
      // Stops as soon as the second call's tool result is visible. Without the
      // persisted-view read this predicate never matched: the second step reported
      // no toolResults, so the loop kept going and made a third model call.
      stopWhen: ({ steps }) => {
        const last = steps[steps.length - 1] as { content?: unknown[]; toolResults?: Array<{ toolCallId?: string }> };
        captured.push({ contentLength: last?.content?.length ?? 0, toolResultIds: toolResultIds(last) });
        return toolResultIds(last).includes('call_second');
      },
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', model: 'observer-model' },
          { content: '<observations>\n* User asked for two echoes.\n</observations>' },
        );
        mock.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_first', name: 'echoTool', arguments: { input: 'first' } }] },
        );
        mock.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_second', name: 'echoTool', arguments: { input: 'second' } }] },
        );
        mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Both echoed.' });
      },
    });

    // Two model calls: step 0's content must survive the drain at step 1, and step
    // 1's own tool results must reach stopWhen so it stops there.
    expect(requests.filter(request => request.body.model === 'gpt-4o-mini')).toHaveLength(2);

    const secondStep = captured.at(-1);
    expect(secondStep?.toolResultIds).toEqual(['call_second']);
    expect(secondStep?.contentLength).toBeGreaterThan(0);
  });
});
