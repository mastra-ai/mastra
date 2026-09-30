import { describe, expect, it, vi } from 'vitest';

import { setOwnAvatarTool } from './set-own-avatar';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BASE64 = PNG_BYTES.toString('base64');

type ExecuteFn = (args: { bytes: string; mime: string }, context: Record<string, unknown>) => Promise<unknown>;

function makeContext(agent: { setAvatar?: ReturnType<typeof vi.fn> } | undefined, agentId = 'agent-1') {
  return {
    agent: agentId ? { agentId, toolCallId: 'tc-1', messages: [], suspend: vi.fn() } : undefined,
    mastra: {
      getAgentById: agent ? vi.fn(() => agent) : undefined,
    },
  };
}

describe('setOwnAvatarTool', () => {
  it('decodes base64 bytes and calls agent.setAvatar', async () => {
    const setAvatar = vi.fn(async () => ({ url: 'mastra-avatar:agent-1', syncedChannels: [] }));
    const ctx = makeContext({ setAvatar });

    const result = await (setOwnAvatarTool as unknown as { execute: ExecuteFn }).execute(
      { bytes: PNG_BASE64, mime: 'image/png' },
      ctx,
    );

    expect(setAvatar).toHaveBeenCalledTimes(1);
    const call = setAvatar.mock.calls[0] as unknown as [Buffer, string];
    expect(Buffer.isBuffer(call[0])).toBe(true);
    expect(call[0].equals(PNG_BYTES)).toBe(true);
    expect(call[1]).toBe('image/png');
    expect(result).toEqual({ ok: true, url: 'mastra-avatar:agent-1', syncedChannels: [] });
  });

  it('returns an error when no agent context is present', async () => {
    const result = await (setOwnAvatarTool as unknown as { execute: ExecuteFn }).execute(
      { bytes: PNG_BASE64, mime: 'image/png' },
      { mastra: {} },
    );
    expect(result).toEqual({
      ok: false,
      error: 'set_own_avatar can only be called from an agent run context.',
    });
  });

  it('returns an error when agent has no setAvatar method', async () => {
    const ctx = makeContext({});
    const result = await (setOwnAvatarTool as unknown as { execute: ExecuteFn }).execute(
      { bytes: PNG_BASE64, mime: 'image/png' },
      ctx,
    );
    expect(result).toEqual({ ok: false, error: 'Agent "agent-1" does not support setAvatar.' });
  });

  it('returns an error when base64 payload decodes to zero bytes', async () => {
    const setAvatar = vi.fn();
    const ctx = makeContext({ setAvatar });
    const result = await (setOwnAvatarTool as unknown as { execute: ExecuteFn }).execute(
      { bytes: '====', mime: 'image/png' },
      ctx,
    );
    expect(result).toEqual({ ok: false, error: 'Decoded avatar bytes were empty.' });
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('surfaces errors thrown by agent.setAvatar', async () => {
    const setAvatar = vi.fn(async () => {
      throw new Error('boom');
    });
    const ctx = makeContext({ setAvatar });
    const result = await (setOwnAvatarTool as unknown as { execute: ExecuteFn }).execute(
      { bytes: PNG_BASE64, mime: 'image/png' },
      ctx,
    );
    expect(result).toEqual({ ok: false, error: 'Failed to set avatar: boom' });
  });
});
