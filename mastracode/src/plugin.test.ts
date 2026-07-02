import { describe, expect, it, vi } from 'vitest';

import { writeToolProgress } from './plugin';

describe('writeToolProgress', () => {
  it('writes transient Mastra Code progress chunks with the current tool call id', async () => {
    const writer = { custom: vi.fn().mockResolvedValue(undefined) };

    await writeToolProgress(
      {
        writer: writer as any,
        agent: { toolCallId: 'call-123' } as any,
      },
      { status: 'thinking', detail: 'Agent is answering…' },
    );

    expect(writer.custom).toHaveBeenCalledWith({
      type: 'data-mastracode-tool-progress',
      data: {
        toolCallId: 'call-123',
        progress: { status: 'thinking', detail: 'Agent is answering…' },
      },
      transient: true,
    });
  });

  it('does nothing when the tool is not running in an agent context', async () => {
    const writer = { custom: vi.fn().mockResolvedValue(undefined) };

    await writeToolProgress({ writer: writer as any }, 'starting');

    expect(writer.custom).not.toHaveBeenCalled();
  });
});
