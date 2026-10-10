import { describe, expect, it, vi } from 'vitest';

import { createSetOwnAvatarTool } from './set-own-avatar';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type ExecuteFn = (input: any, context: any) => Promise<any>;

function ctxWithAgent(agent: any) {
  return {
    agent: { agentId: 'agent-1' },
    mastra: {
      getAgentById: (id: string) => (id === 'agent-1' ? agent : undefined),
    },
  } as any;
}

describe('createSetOwnAvatarTool', () => {
  it('calls the injected image generator with the model-supplied prompt and forwards bytes to agent.setAvatar', async () => {
    const generateImage = vi.fn().mockResolvedValue({ bytes: PNG_HEADER, mime: 'image/png' });
    const setAvatar = vi
      .fn()
      .mockResolvedValue({ url: 'mastra-avatar:agent-1', syncedChannels: [{ platform: 'discord', ok: true }] });
    const tool = createSetOwnAvatarTool({ generateImage });

    const result = await (tool.execute as ExecuteFn)({ prompt: 'a friendly robot' }, ctxWithAgent({ setAvatar }));

    expect(generateImage).toHaveBeenCalledExactlyOnceWith('a friendly robot');
    expect(setAvatar).toHaveBeenCalledExactlyOnceWith(PNG_HEADER, 'image/png');
    expect(result).toEqual({
      ok: true,
      url: 'mastra-avatar:agent-1',
      syncedChannels: [{ platform: 'discord', ok: true }],
    });
  });

  it('never asks the model for image bytes — input schema is prompt-only', () => {
    const tool = createSetOwnAvatarTool({ generateImage: vi.fn() });
    const schemaKeys = Object.keys((tool.inputSchema as any).shape ?? {});
    expect(schemaKeys).toEqual(['prompt']);
  });

  it('returns a structured error when there is no agent context', async () => {
    const tool = createSetOwnAvatarTool({ generateImage: vi.fn() });
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, { mastra: {} });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('agent run context') });
  });

  it('returns a structured error when the resolved agent lacks setAvatar', async () => {
    const tool = createSetOwnAvatarTool({ generateImage: vi.fn() });
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, ctxWithAgent({}));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('does not support setAvatar') });
  });

  it('returns a structured error when the image generator throws', async () => {
    const generateImage = vi.fn().mockRejectedValue(new Error('rate limited'));
    const tool = createSetOwnAvatarTool({ generateImage });
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, ctxWithAgent({ setAvatar: vi.fn() }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('rate limited') });
  });

  it('returns a structured error when the generator returns empty bytes', async () => {
    const generateImage = vi.fn().mockResolvedValue({ bytes: Buffer.alloc(0), mime: 'image/png' });
    const tool = createSetOwnAvatarTool({ generateImage });
    const setAvatar = vi.fn();
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, ctxWithAgent({ setAvatar }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('no bytes') });
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('returns a structured error when the generator returns an unsupported mime', async () => {
    const generateImage = vi.fn().mockResolvedValue({ bytes: PNG_HEADER, mime: 'image/tiff' });
    const tool = createSetOwnAvatarTool({ generateImage });
    const setAvatar = vi.fn();
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, ctxWithAgent({ setAvatar }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("unsupported mime 'image/tiff'") });
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by agent.setAvatar as structured errors', async () => {
    const setAvatar = vi.fn().mockRejectedValue(new Error('store offline'));
    const generateImage = vi.fn().mockResolvedValue({ bytes: PNG_HEADER, mime: 'image/png' });
    const tool = createSetOwnAvatarTool({ generateImage });
    const result = await (tool.execute as ExecuteFn)({ prompt: 'x' }, ctxWithAgent({ setAvatar }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('store offline') });
  });
});
