import { describe, expect, it } from 'vitest';
import { withToolTitle } from './tool-title';

describe('withToolTitle MCP App pointer', () => {
  const tool = { mcp: { _meta: { ui: { resourceUri: 'ui://w/view', serverId: 'w' } } } } as any;
  const app = { resourceUri: 'ui://w/view', serverId: 'w', mimeType: 'text/html;profile=mcp-app' };

  it('attaches toolMetadata.app to tool-call chunks', () => {
    for (const type of ['tool-call', 'tool-call-input-streaming-start']) {
      expect(withToolTitle({ type, payload: { toolCallId: 'c' } }, tool).payload).toEqual({
        toolCallId: 'c',
        toolMetadata: { app },
      });
    }
  });

  it('leaves tools without a UI pointer and non-tool chunks unchanged', () => {
    const chunk = { type: 'tool-call', payload: { toolCallId: 'c' } };
    expect(withToolTitle(chunk, { mcp: { _meta: {} } } as any)).toBe(chunk);
    expect(withToolTitle(chunk, undefined)).toBe(chunk);
    const text = { type: 'text-delta', payload: {} };
    expect(withToolTitle(text, tool)).toBe(text);
  });
});
