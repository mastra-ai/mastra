import { MessageList } from '@mastra/core/agent/message-list';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';

import { createInngestDurableAgenticWorkflow } from './create-inngest-agentic-workflow';

const tripwire = { reason: 'rejected by gate', processorId: 'gate', retry: false };

vi.mock('@mastra/core/agent/durable', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/agent/durable')>();
  return {
    ...actual,
    runDurableFinishSideEffects: vi.fn(async (args: any) => ({
      messageListState: args.messageListState,
      outputText: args.outputResult.text,
      tripwire,
    })),
  };
});

function findEntry(steps: any[], predicate: (entry: any) => boolean): any {
  for (const entry of steps ?? []) {
    if (predicate(entry)) return entry;
    const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
    if (inner?.executionGraph) {
      const nested = findEntry(inner.executionGraph.steps, predicate);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findEntry(entry.steps, predicate);
      if (nested) return nested;
    }
  }
  return undefined;
}

// #25996: a processOutputResult abort must surface as a tripwire on the Inngest engine too.
describe('createInngestDurableAgenticWorkflow processOutputResult tripwire', () => {
  it('emits a tripwire chunk and finishes with reason tripwire', async () => {
    const workflow = createInngestDurableAgenticWorkflow({ inngest: new Inngest({ id: 'inngest-tripwire-tests' }) });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      e => e.type === 'mapping' && e.id === 'map-final-output',
    );

    const published: any[] = [];
    const pubsub = { publish: vi.fn(async (_topic: string, event: any) => void published.push(event)) };

    const result = await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps: [{ text: 'hello gate' }],
        accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        messageListState: new MessageList().serialize(),
        state: {},
      },
      getInitData: () => ({ runId: 'run-1', agentId: 'agent-1' }),
      mastra: { getLogger: () => undefined },
      [PUBSUB_SYMBOL]: pubsub,
    });

    expect(result.stepResult.reason).toBe('tripwire');
    const chunk = published.map(e => e.data).find(d => d?.type === 'tripwire');
    expect(chunk?.payload).toEqual(tripwire);
  });
});
