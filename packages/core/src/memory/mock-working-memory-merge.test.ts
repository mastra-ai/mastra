import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from './mock';

describe('MockMemory working memory merge semantics', () => {
  const threadId = 'thread-1';
  const resourceId = 'resource-1';

  async function setupMemory(useSchema: boolean) {
    const options: ConstructorParameters<typeof MockMemory>[0] = {
      enableWorkingMemory: true,
    };

    if (useSchema) {
      options.options = {
        workingMemory: {
          enabled: true,
          schema: z.object({
            name: z.string().optional(),
            age: z.number().optional(),
            location: z.string().optional(),
          }),
        },
      };
    }

    const memory = new MockMemory(options);

    // Create a thread so the tool doesn't error
    await memory.createThread({ threadId, resourceId });

    return memory;
  }

  async function callUpdateTool(memory: MockMemory, input: string) {
    const config = (memory as any).getMergedThreadConfig();
    const tools = memory.listTools(config);
    const tool = tools.updateWorkingMemory;
    if (!tool) throw new Error('updateWorkingMemory tool not found');

    await (tool as any).execute({ memory: input }, { agent: { threadId, resourceId }, memory });
  }

  it('replaces working memory entirely for template-based (no schema)', async () => {
    const memory = await setupMemory(false);

    await callUpdateTool(memory, JSON.stringify({ name: 'Alice', age: 30, location: 'NYC' }));
    await callUpdateTool(memory, JSON.stringify({ location: 'LA' }));

    const wm = await memory.getWorkingMemory({ threadId, resourceId });
    const parsed = JSON.parse(wm!);
    expect(parsed).toEqual({ location: 'LA' });
    expect(parsed.name).toBeUndefined();
  });

  it('merges working memory for schema-based configs', async () => {
    const memory = await setupMemory(true);

    await callUpdateTool(memory, JSON.stringify({ name: 'Alice', age: 30, location: 'NYC' }));
    await callUpdateTool(memory, JSON.stringify({ location: 'LA' }));

    const wm = await memory.getWorkingMemory({ threadId, resourceId });
    const parsed = JSON.parse(wm!);
    expect(parsed).toEqual({ name: 'Alice', age: 30, location: 'LA' });
  });

  it('overwrites fields in schema-based merge when explicitly provided', async () => {
    const memory = await setupMemory(true);

    await callUpdateTool(memory, JSON.stringify({ name: 'Alice', age: 30 }));
    await callUpdateTool(memory, JSON.stringify({ name: 'Bob', age: 25 }));

    const wm = await memory.getWorkingMemory({ threadId, resourceId });
    const parsed = JSON.parse(wm!);
    expect(parsed).toEqual({ name: 'Bob', age: 25 });
  });

  it('handles first write with no existing data in schema mode', async () => {
    const memory = await setupMemory(true);

    await callUpdateTool(memory, JSON.stringify({ name: 'Alice' }));

    const wm = await memory.getWorkingMemory({ threadId, resourceId });
    const parsed = JSON.parse(wm!);
    expect(parsed).toEqual({ name: 'Alice' });
  });
});
