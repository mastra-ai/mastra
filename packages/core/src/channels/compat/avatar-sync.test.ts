import { describe, expect, it, vi } from 'vitest';

import { applyPlatformAvatarSync } from './avatar-sync';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIME = 'image/png';

describe('applyPlatformAvatarSync', () => {
  describe('discord', () => {
    it('prefers discord.js client.user.setAvatar when exposed', async () => {
      const setAvatar = vi.fn().mockResolvedValue(undefined);
      const adapter = { client: { user: { setAvatar } } } as any;

      const result = await applyPlatformAvatarSync('discord', adapter, PNG, MIME);

      expect(result).toEqual({ handled: true });
      expect(setAvatar).toHaveBeenCalledExactlyOnceWith(PNG);
    });

    it('falls back to rest.patch("/users/@me") with a data URI body', async () => {
      const patch = vi.fn().mockResolvedValue(undefined);
      const adapter = { rest: { patch } } as any;

      const result = await applyPlatformAvatarSync('discord', adapter, PNG, MIME);

      expect(result).toEqual({ handled: true });
      expect(patch).toHaveBeenCalledExactlyOnceWith('/users/@me', {
        body: { avatar: `data:${MIME};base64,${PNG.toString('base64')}` },
      });
    });

    it('returns handled:false when the adapter exposes neither shape', async () => {
      const result = await applyPlatformAvatarSync('discord', {} as any, PNG, MIME);
      expect(result.handled).toBe(false);
      if (!result.handled) expect(result.reason).toMatch(/client\.user\.setAvatar|rest\.patch/);
    });

    it('propagates errors from the underlying discord call', async () => {
      const setAvatar = vi.fn().mockRejectedValue(new Error('discord: 401'));
      const adapter = { client: { user: { setAvatar } } } as any;
      await expect(applyPlatformAvatarSync('discord', adapter, PNG, MIME)).rejects.toThrow('discord: 401');
    });
  });

  describe('platforms without a public bot-avatar API', () => {
    it.each([
      ['slack', /dashboard/i],
      ['telegram', /BotFather/i],
      ['teams', /public bot-avatar/i],
      ['gchat', /public bot-avatar/i],
      ['google-chat', /public bot-avatar/i],
    ])('returns handled:false with a reason for %s', async (platform, reasonMatcher) => {
      const result = await applyPlatformAvatarSync(platform, {} as any, PNG, MIME);
      expect(result.handled).toBe(false);
      if (!result.handled) expect(result.reason).toMatch(reasonMatcher);
    });
  });

  it('returns handled:false with a reason for unknown platforms', async () => {
    const result = await applyPlatformAvatarSync('mystery-net', {} as any, PNG, MIME);
    expect(result.handled).toBe(false);
    if (!result.handled) expect(result.reason).toMatch(/no built-in avatar sync/);
  });
});
