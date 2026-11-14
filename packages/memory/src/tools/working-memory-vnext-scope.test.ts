import type { MemoryConfig } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../index';

type WorkingMemoryOptions = NonNullable<MemoryConfig['workingMemory']>;

const RESOURCE_ID = 'user-1';
const APOLLO = '- Project: Apollo launch';

function setup(workingMemory: WorkingMemoryOptions) {
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: { workingMemory },
  });
  const tools = Object.values(memory.listTools());
  expect(tools).toHaveLength(1);
  const tool = tools[0]!;

  const update = (
    threadId: string,
    input: {
      newMemory: string;
      searchString?: string;
      updateReason?: 'append-new-memory' | 'clarify-existing-memory' | 'replace-irrelevant-memory';
    },
  ) => tool.execute!(input, { agent: { threadId, resourceId: RESOURCE_ID }, memory } as any);

  const read = (threadId: string) => memory.getWorkingMemory({ threadId, resourceId: RESOURCE_ID });

  return { update, read };
}

const vnext = { enabled: true, version: 'vnext', template: '# Notes\n' } as const satisfies WorkingMemoryOptions;

// Technical: the vNext tool resolves `scope || 'resource'` for its ID checks, but the
// guard that rejects `replace-irrelevant-memory` for resource-scoped memory compared the
// raw config value, so it never fired when scope was left at its default. (#30287)
describe('vNext working memory tool: replace-irrelevant-memory across threads (#30287)', () => {
  it.each([
    ['scope left at its default', { ...vnext }],
    ["scope: 'resource' set explicitly", { ...vnext, scope: 'resource' as const }],
  ])("another thread can't erase shared resource memory as irrelevant (%s)", async (_label, workingMemory) => {
    const { update, read } = setup(workingMemory);

    await update('thread-a', { newMemory: APOLLO, updateReason: 'append-new-memory' });
    const result = await update('thread-b', {
      newMemory: '- Project: (none)',
      searchString: APOLLO,
      updateReason: 'replace-irrelevant-memory',
    });

    // Both threads share one resource-scoped working memory, so the tool refuses to
    // drop a fact just because thread B finds it irrelevant: thread A still sees it.
    // The model is told why, not that it forgot a searchString it did send.
    expect(result).toMatchObject({ success: false, reason: expect.stringContaining('shared') });
    expect(result.reason).not.toContain('no searchString was provided');
    expect(await read('thread-a')).toBe(APOLLO);
    expect(await read('thread-b')).toBe(APOLLO);
  });

  it('still lets a thread clarify an existing resource-scoped line when scope is left at its default', async () => {
    const { update, read } = setup({ ...vnext });

    await update('thread-a', { newMemory: APOLLO, updateReason: 'append-new-memory' });
    await update('thread-b', {
      newMemory: '- Project: Apollo launch (moved to March)',
      searchString: APOLLO,
      updateReason: 'clarify-existing-memory',
    });

    const seenByA = await read('thread-a');
    expect(seenByA).toContain('- Project: Apollo launch (moved to March)');
    expect(seenByA?.match(/Project:/g)).toHaveLength(1);
  });

  it("with scope: 'thread', a thread can replace its own irrelevant memory and other threads are untouched", async () => {
    const { update, read } = setup({ ...vnext, scope: 'thread' });

    await update('thread-a', { newMemory: APOLLO, updateReason: 'append-new-memory' });
    await update('thread-b', { newMemory: '- Project: Gemini', updateReason: 'append-new-memory' });
    await update('thread-a', {
      newMemory: '- Project: (none)',
      searchString: APOLLO,
      updateReason: 'replace-irrelevant-memory',
    });

    const seenByA = await read('thread-a');
    expect(seenByA).toContain('- Project: (none)');
    expect(seenByA).not.toContain('Apollo');
    expect(await read('thread-b')).toContain('- Project: Gemini');
    expect(await read('thread-b')).not.toContain('(none)');
  });
});
