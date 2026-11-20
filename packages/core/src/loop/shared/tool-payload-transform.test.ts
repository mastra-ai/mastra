import { describe, expect, it } from 'vitest';
import type { CoreTool } from '../../tools/types';
import { applyToolPayloadTransformToChunk } from './tool-payload-transform';

describe('applyToolPayloadTransformToChunk', () => {
  it('stamps the tool title on streaming-start chunks and leaves untitled tools untouched', async () => {
    const tools = {
      search: { title: 'Search the web' },
      plain: {},
    } as unknown as Record<string, CoreTool>;
    const titled = {
      type: 'tool-call-input-streaming-start',
      runId: 'run-1',
      from: 'AGENT',
      payload: { toolCallId: 'tc-1', toolName: 'search' },
    };
    const untitled = { ...titled, payload: { toolCallId: 'tc-2', toolName: 'plain' } };

    const stamped = await applyToolPayloadTransformToChunk(titled, { tools });
    expect(stamped.payload).toEqual({ toolCallId: 'tc-1', toolName: 'search', title: 'Search the web' });

    const untouched = await applyToolPayloadTransformToChunk(untitled, { tools });
    expect(untouched).toBe(untitled);
  });
});
