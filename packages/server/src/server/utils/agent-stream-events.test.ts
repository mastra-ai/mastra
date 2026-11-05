import { describe, expect, it } from 'vitest';

import { toAgentStreamChunks } from './agent-stream-events';

describe('toAgentStreamChunks', () => {
  const nested = { type: 'text-delta', runId: 'sub', from: 'AGENT', index: 7, payload: { id: 't', text: 'hi' } };

  it("replaces a forwarded sub-agent chunk's index with the envelope's", () => {
    const [frame] = toAgentStreamChunks({ type: 'chunk', runId: 'parent', data: nested, index: 3 } as any);
    expect(frame).toEqual({ ...nested, index: 3 });
  });

  it("drops a forwarded sub-agent chunk's index when the envelope has none", () => {
    const [frame] = toAgentStreamChunks({ type: 'chunk', runId: 'parent', data: nested } as any);
    expect(frame).not.toHaveProperty('index');
    expect(frame).toMatchObject({ type: 'text-delta', payload: { text: 'hi' } });
  });
});
