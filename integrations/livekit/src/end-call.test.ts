import { describe, expect, it, vi } from 'vitest';
import { createEndCallTool } from './end-call';

// Minimal stand-in for the tool execution context: only the agent identity fields the tool reads.
function ctx(agent?: { resourceId?: string; threadId?: string }) {
  return { agent } as Parameters<NonNullable<ReturnType<typeof createEndCallTool>['execute']>>[1];
}

describe('createEndCallTool', () => {
  it('signals the end and returns { ended: true }', async () => {
    const tool = createEndCallTool();
    const result = await tool.execute!({ reason: 'caller said goodbye' }, ctx());
    expect(result).toEqual({ ended: true });
  });

  it('passes the reason and caller identity to onEndCall', async () => {
    const onEndCall = vi.fn();
    const tool = createEndCallTool({ onEndCall });
    await tool.execute!({ reason: 'task complete' }, ctx({ resourceId: 'caller-1', threadId: 'call-1' }));
    expect(onEndCall).toHaveBeenCalledWith({ reason: 'task complete', resourceId: 'caller-1', threadId: 'call-1' });
  });

  it('normalizes a null reason to undefined', async () => {
    const onEndCall = vi.fn();
    const tool = createEndCallTool({ onEndCall });
    await tool.execute!({ reason: null }, ctx({ resourceId: 'r' }));
    expect(onEndCall).toHaveBeenCalledWith({ reason: undefined, resourceId: 'r', threadId: undefined });
  });

  it('works without an onEndCall hook', async () => {
    const tool = createEndCallTool();
    await expect(tool.execute!({ reason: 'done' }, ctx({ resourceId: 'r' }))).resolves.toEqual({ ended: true });
  });

  it('defaults the tool id to endCall and allows an override', () => {
    expect(createEndCallTool().id).toBe('endCall');
    expect(createEndCallTool({ id: 'hangUp' }).id).toBe('hangUp');
  });
});
