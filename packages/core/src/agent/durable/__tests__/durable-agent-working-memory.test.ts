/**
 * DurableAgent Working Memory Injection Tests
 *
 * Regression tests for the ordering bug where the durable preparation path
 * resolved the input-processor chain BEFORE writing the per-request memory
 * context (`MastraMemory`) onto the request context.
 *
 * `Memory.getInputProcessors()` decides whether to add the `working-memory`
 * injector by reading `requestContext.get('MastraMemory')?.memoryConfig`. With
 * working memory disabled in the constructor and enabled per-request (the
 * documented setup), resolving before that value is set made the per-request
 * config invisible, so the injector was silently dropped: working memory was
 * still SAVED by the update-working-memory tool, but never READ back into the
 * prompt.
 *
 * The fix hoists the thread/memory context setup ahead of processor resolution.
 * These tests assert:
 *   (a) constructor WM disabled + per-request WM enabled -> stored working
 *       memory is injected into the durable run's system messages.
 *   (b) no per-request memory options -> the injector is NOT added (gating for
 *       background runs / agents without per-request memory must stay intact).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { prepareForDurableExecution } from '../preparation';

const STORED_WORKING_MEMORY = 'User prefers dark mode and concise answers in Danish.';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Build a memory instance with working memory DISABLED in the constructor (the
 * documented per-request setup), pre-seeded with resource-scoped working memory
 * so an enabled run has something to inject.
 */
async function createMemoryWithStoredWorkingMemory(resourceId: string) {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { workingMemory: { enabled: false } } });

  // Seed resource-scoped working memory. updateWorkingMemory uses the merged
  // (per-call) config to gate the write, so pass an enabled config here.
  await memory.updateWorkingMemory({
    threadId: 'unused-thread',
    resourceId,
    workingMemory: STORED_WORKING_MEMORY,
    memoryConfig: { workingMemory: { enabled: true, scope: 'resource' } },
  });

  return memory;
}

describe('DurableAgent working memory injection (AIC-4279)', () => {
  it('(a) injects stored working memory when enabled per-request, even though the constructor disables it', async () => {
    const resourceId = 'wm-resource-a';
    const memory = await createMemoryWithStoredWorkingMemory(resourceId);

    const baseAgent = new Agent({
      id: 'wm-inject-agent',
      name: 'WM Inject Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      memory,
    });

    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      options: {
        memory: {
          thread: 'wm-thread-a',
          resource: resourceId,
          options: { workingMemory: { enabled: true, scope: 'resource' } },
        },
      },
    });

    const systemText = result.messageList.getAllSystemMessages().map(m => JSON.stringify(m.content)).join('\n');

    // The working-memory injector ran (its system instruction is present)...
    expect(systemText).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
    // ...and the actual stored content was injected into the prompt.
    expect(systemText).toContain(STORED_WORKING_MEMORY);
  });

  it('(b) does NOT inject working memory when no per-request memory options are provided (gating preserved)', async () => {
    const resourceId = 'wm-resource-b';
    const memory = await createMemoryWithStoredWorkingMemory(resourceId);

    const baseAgent = new Agent({
      id: 'wm-gated-agent',
      name: 'WM Gated Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      memory,
    });

    // Thread + resource, but NO options -> working memory stays off (constructor disabled).
    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      options: {
        memory: {
          thread: 'wm-thread-b',
          resource: resourceId,
        },
      },
    });

    const systemText = result.messageList.getAllSystemMessages().map(m => JSON.stringify(m.content)).join('\n');

    expect(systemText).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
    expect(systemText).not.toContain(STORED_WORKING_MEMORY);
  });

  it('(b2) does NOT inject working memory for an agent without memory configured', async () => {
    const baseAgent = new Agent({
      id: 'wm-no-memory-agent',
      name: 'WM No Memory Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
    });

    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      options: {
        memory: {
          thread: 'wm-thread-b2',
          resource: 'wm-resource-b2',
          options: { workingMemory: { enabled: true, scope: 'resource' } },
        },
      },
    });

    const systemText = result.messageList.getAllSystemMessages().map(m => JSON.stringify(m.content)).join('\n');

    expect(systemText).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
  });

  it('resolves the working-memory processor only once the memory context is seeded (root-cause check)', async () => {
    const resourceId = 'wm-resource-resolve';
    const memory = await createMemoryWithStoredWorkingMemory(resourceId);

    const agent = new Agent({
      id: 'wm-resolve-agent',
      name: 'WM Resolve Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      memory,
    });

    // Reach the uncombined LLM-request processor list, mirroring how the durable
    // path resolves the chain. This is the exact ordering that the bug got wrong.
    const resolve = (rc: RequestContext) =>
      (agent as unknown as {
        listResolvedLLMRequestProcessors(rc: RequestContext): Promise<Array<{ id: string }>>;
      }).listResolvedLLMRequestProcessors(rc);

    // Without MastraMemory in context (what the durable path used to do): the
    // per-request enablement is invisible, so no working-memory processor.
    const withoutContext = await resolve(new RequestContext());
    expect(withoutContext.map(p => p.id)).not.toContain('working-memory');

    // With MastraMemory seeded first (what the fix now does): injector present.
    const rcWithContext = new RequestContext();
    rcWithContext.set('MastraMemory', {
      resourceId,
      memoryConfig: { workingMemory: { enabled: true, scope: 'resource' } },
    });
    const withContext = await resolve(rcWithContext);
    expect(withContext.map(p => p.id)).toContain('working-memory');
  });
});
