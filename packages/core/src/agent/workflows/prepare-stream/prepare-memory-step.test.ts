/**
 * Regression tests for #16216 — `saveThread` upsert wipes thread metadata
 * when `prepare-memory-step` reports `threadExists: false` even though the
 * thread was just persisted by the same step.
 *
 * The bug:
 *  1. `prepare-memory-step` calls `memory.createThread({ saveThread: true })`,
 *     which writes the thread to the storage backend.
 *  2. The same step returns `threadExists: !!existingThread` — i.e. `false`,
 *     because `existingThread` was looked up before the create.
 *  3. `#executeOnFinish` reads the (incorrect) `false` flag and calls
 *     `memory.createThread()` a second time at end-of-run with whatever
 *     `thread.metadata` it has (often stale or `undefined`), triggering the
 *     storage backend's upsert which overwrites any metadata a processor
 *     wrote via `updateThread` during the run.
 *
 * The fix: derive `threadExists` from post-step state — if a `threadObject`
 * exists at the end of the step, the thread is persisted, regardless of
 * whether it pre-existed or was just created.
 */
import { describe, it, expect } from 'vitest';
import { noopLogger } from '../../../logger';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { createPrepareMemoryStep } from './prepare-memory-step';
import type { AgentCapabilities } from './schema';

const RESOURCE_ID = 'r1';

function buildCapabilities(): AgentCapabilities {
  // Only the fields actually exercised by createPrepareMemoryStep need to be
  // realistic; the rest are typed-but-unused in this code path.
  return {
    logger: noopLogger,
    generateMessageId: () => `msg-${Math.random().toString(36).slice(2)}`,
    runInputProcessors: async () => ({ tripwire: undefined }) as any,
  } as unknown as AgentCapabilities;
}

function buildStep(memory: MockMemory, threadId: string) {
  return createPrepareMemoryStep({
    capabilities: buildCapabilities(),
    options: { messages: [{ role: 'user', content: 'hello' }] } as any,
    threadFromArgs: { id: threadId },
    resourceId: RESOURCE_ID,
    runId: 'test-run',
    requestContext: new RequestContext(),
    methodType: 'stream' as any,
    instructions: 'you are a test agent',
    memoryConfig: undefined,
    memory,
    isResume: false,
  });
}

describe('createPrepareMemoryStep — threadExists flag (#16216)', () => {
  it('returns threadExists: true after creating a brand new thread', async () => {
    const memory = new MockMemory();
    const step = buildStep(memory, 't-new');

    const result = (await step.execute({} as any)) as any;

    // Sanity: the thread was actually persisted by the step.
    const persisted = await memory.getThreadById({ threadId: 't-new' });
    expect(persisted).not.toBeNull();
    expect(persisted?.id).toBe('t-new');

    // The bug under #16216 is that this is `false` even though the step just
    // created the thread. With the fix, this is `true`.
    expect(result.threadExists).toBe(true);
  });

  it('returns threadExists: true when the thread already existed', async () => {
    const memory = new MockMemory();
    await memory.createThread({
      threadId: 't-existing',
      resourceId: RESOURCE_ID,
      saveThread: true,
    });

    const step = buildStep(memory, 't-existing');
    const result = (await step.execute({} as any)) as any;

    expect(result.threadExists).toBe(true);
  });

  it('preserves processor-written metadata across the executeOnFinish guard', async () => {
    // End-to-end reproduction of the scenario from the issue body.
    const memory = new MockMemory();
    const memoryStore = await memory.storage.getStore('memory');

    // 1) prepare-memory-step runs and creates the thread.
    const step = buildStep(memory, 't-merge');
    const stepResult = (await step.execute({} as any)) as any;

    // Root-cause assertion: localizes a regression to the flag itself rather
    // than the downstream metadata effect.
    expect(stepResult.threadExists).toBe(true);

    // 2) A processor writes metadata mid-run via the merging updateThread API.
    await memoryStore!.updateThread({
      id: 't-merge',
      title: '',
      metadata: { writtenByProcessor: 'value1' },
    });

    // 3) Simulate the guard from agent.ts `#executeOnFinish`:
    //      if (!threadExists) await memory.createThread({ ... metadata: thread.metadata })
    //    where `thread.metadata` is the stale (undefined) input passed into the step.
    //    With the bug, threadExists is `false` → createThread runs → upsert wipes
    //    the processor-written metadata. With the fix, threadExists is `true` →
    //    the second createThread is skipped → metadata is preserved.
    if (!stepResult.threadExists) {
      await memory.createThread({
        threadId: 't-merge',
        resourceId: RESOURCE_ID,
        metadata: undefined,
      });
    }

    const after = await memoryStore!.getThreadById({ threadId: 't-merge' });
    expect(after?.metadata).toEqual({ writtenByProcessor: 'value1' });
  });
});
