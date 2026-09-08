/**
 * A suspended run's snapshot must grow linearly with the steps taken before the
 * suspend, not quadratically.
 *
 * Every buffered step carried the whole response conversation so far — twice,
 * as `dbMessages` and `uiMessages` — so each extra tool call added a copy of
 * everything that came before it. A HITL agent that works through a dozen
 * large tool results before its first approval produced snapshots in the
 * hundreds of megabytes, exhausting the process heap and, on Postgres, taking
 * the run list down with it.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

// Large enough that the message mirrors dominate the snapshot, the way a real
// tool result payload does.
const TOOL_PAYLOAD = 'p'.repeat(4000);

function createBulkyTool() {
  return createTool({
    id: 'bulky',
    description: 'Returns a large payload.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ context }) => ({ n: context.n, payload: TOOL_PAYLOAD }),
  });
}

function createApprovalTool() {
  return createTool({
    id: 'approve',
    description: 'Requires approval.',
    inputSchema: z.object({ n: z.number() }),
    requireApproval: true,
    execute: async () => ({ approved: true }),
  });
}

// Calls the bulky tool `stepsBeforeSuspend` times, then the approval tool. Each
// response carries a request body of its own, so the existing request dedupe
// cannot mask the growth being measured here.
function createSteppingModel(stepsBeforeSuspend: number) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const isLast = call > stepsBeforeSuspend;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: { body: `PROMPT-${call}-${'q'.repeat(2000)}` },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: `call-${call}`,
            toolName: isLast ? 'approve' : 'bulky',
            input: JSON.stringify({ n: call }),
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      } as any;
    },
  });
}

async function runToSuspend(stepsBeforeSuspend: number) {
  const storage = new InMemoryStore();
  const persisted: string[] = [];
  const workflowsStore: any = await storage.getStore('workflows');
  const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
  vi.spyOn(workflowsStore, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    persisted.push(JSON.stringify(args.snapshot));
    return originalPersist(args);
  });

  const agent = new Agent({
    id: 'hitl',
    name: 'hitl',
    instructions: 'Call the bulky tool repeatedly, then the approve tool.',
    model: createSteppingModel(stepsBeforeSuspend),
    tools: { bulky: createBulkyTool(), approve: createApprovalTool() },
  });
  new Mastra({ logger: false, storage, agents: { hitl: agent } });

  const stream = await agent.stream('go', { maxSteps: stepsBeforeSuspend + 2 });
  for await (const _ of stream.fullStream) {
    // drain until the approval suspends the run
  }

  const largest = persisted.reduce((max, s) => Math.max(max, s.length), 0);
  return { largestSnapshotBytes: largest, persisted };
}

describe('suspended snapshot growth', () => {
  it('does not grow quadratically with the steps taken before the suspend', async () => {
    const [fewer, more] = await Promise.all([runToSuspend(8), runToSuspend(16)]);

    // Quadratic growth lands near 4x (it measured 2.8x here before the fix,
    // with the fixed per-step overhead damping it). Linear growth lands near 2x.
    console.info(
      `suspended snapshot: ${fewer.largestSnapshotBytes} -> ${more.largestSnapshotBytes} bytes ` +
        `(${(more.largestSnapshotBytes / fewer.largestSnapshotBytes).toFixed(2)}x)`,
    );
    expect(more.largestSnapshotBytes / fewer.largestSnapshotBytes).toBeLessThan(2.3);
  }, 60_000);
});
