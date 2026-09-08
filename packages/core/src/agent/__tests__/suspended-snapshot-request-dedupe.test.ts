/**
 * A suspended run must not persist one full copy of the invariant request per
 * step.
 *
 * Every buffered step stores the request that produced it, and that request's
 * body carries the tool schemas plus the system instruction — identical across
 * the steps of a run. A HITL agent that makes a dozen tool calls before its
 * first approval suspend therefore wrote a dozen copies of the same blob into a
 * single workflow snapshot, which on MongoDB exceeds the hard 16 MB
 * per-document limit: the write fails, the suspended run is never saved, and
 * the later resume cannot find it.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

// Stands in for the tool-schema + system-instruction blob a provider echoes
// back on every step. Distinctive so it can be counted in the snapshot.
const INVARIANT_BODY = `TOOL-SCHEMA-BLOB-${'x'.repeat(2000)}`;
const STEPS_BEFORE_SUSPEND = 8;

function createNoopTool() {
  return createTool({
    id: 'noop',
    description: 'Does nothing.',
    inputSchema: z.object({ n: z.number() }),
    execute: async () => ({ ok: true }),
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

// Calls the no-op tool STEPS_BEFORE_SUSPEND times, then the approval tool,
// which suspends the run. Every response carries the same `request.body`.
function createSteppingModel(stepsBeforeSuspend: number = STEPS_BEFORE_SUSPEND) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const isLast = call > stepsBeforeSuspend;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: { body: INVARIANT_BODY },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: `call-${call}`,
            toolName: isLast ? 'approve' : 'noop',
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

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

// Runs the HITL agent to its suspend and counts the copies of the invariant
// request body in the snapshot that was persisted for it.
async function countPersistedRequestCopies(stepsBeforeSuspend: number): Promise<number> {
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
    instructions: 'Call the noop tool repeatedly, then the approve tool.',
    model: createSteppingModel(stepsBeforeSuspend),
    tools: { noop: createNoopTool(), approve: createApprovalTool() },
  });
  new Mastra({ logger: false, storage, agents: { hitl: agent } });

  const stream = await agent.stream('go', { maxSteps: stepsBeforeSuspend + 2 });
  for await (const _ of stream.fullStream) {
    // drain until the approval suspends the run
  }

  const suspendedSnapshot = persisted.find(s => s.includes(INVARIANT_BODY));
  expect(suspendedSnapshot).toBeDefined();

  return countOccurrences(suspendedSnapshot!, INVARIANT_BODY);
}

describe('suspended snapshot request dedupe', () => {
  it('persists the invariant request once, not once per step', async () => {
    // Before the fix this run wrote 27 copies: one per step in the buffered
    // step state and again in the step-history output, doubled by the
    // propagated foreach metadata. What survives is one shared copy per
    // __streamState (the request table and the run-level request), which does
    // not grow with step count.
    const copies = await countPersistedRequestCopies(STEPS_BEFORE_SUSPEND);
    expect(copies).toBeLessThanOrEqual(4);
  });

  // The bound above proves the snapshot is small at one step count. This proves
  // the property the fix is actually about: doubling the steps taken before the
  // suspend does not add a single copy.
  it('does not persist more copies as the step count grows', async () => {
    const [fewer, more] = await Promise.all([
      countPersistedRequestCopies(STEPS_BEFORE_SUSPEND),
      countPersistedRequestCopies(STEPS_BEFORE_SUSPEND * 2),
    ]);

    expect(more).toBe(fewer);
  });
});
