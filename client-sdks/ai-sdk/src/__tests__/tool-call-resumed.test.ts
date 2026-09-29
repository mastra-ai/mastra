import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { toAISdkV5Stream } from '../convert-streams';

describe('tool-call-resumed (#24280)', () => {
  it('maps to a data-tool-call-suspended part with the same id and resumed: true', async () => {
    const stream = new ReadableStream<ChunkType>({
      start(controller) {
        controller.enqueue({
          type: 'tool-call-suspended',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'askUser', suspendPayload: { q: '?' }, args: {}, resumeSchema: '' },
        });
        controller.enqueue({
          type: 'tool-call-resumed',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'askUser' },
        });
        controller.close();
      },
    });

    const parts: any[] = [];
    for await (const part of toAISdkV5Stream(stream as unknown as MastraModelOutput, { from: 'agent' })) {
      parts.push(part);
    }

    const suspendedParts = parts.filter(p => p.type === 'data-tool-call-suspended');
    expect(suspendedParts).toHaveLength(2);
    expect(suspendedParts[0].id).toBe('tc-1');
    expect(suspendedParts[0].data.resumed).toBeUndefined();
    expect(suspendedParts[1]).toMatchObject({
      id: 'tc-1',
      data: { state: 'data-tool-call-suspended', toolCallId: 'tc-1', toolName: 'askUser', resumed: true },
    });
  });
});
