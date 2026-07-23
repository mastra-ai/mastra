import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

const slackKey = { platform: 'slack', externalTeamId: 'T-123', externalUserId: 'U-abc' };

describe('ChannelIdentityStorage', () => {
  it('returns null for an unlinked sender', async () => {
    const seed = await createFactoryStorageForTests();

    expect(await seed.channelIdentity.getAccountLink(slackKey)).toBeNull();
  });

  it('links a sender to a tenant and reads it back', async () => {
    const seed = await createFactoryStorageForTests();

    const saved = await seed.channelIdentity.saveAccountLink({
      ...slackKey,
      orgId: 'org-1',
      userId: 'user-1',
    });

    expect(saved).toMatchObject({ orgId: 'org-1', userId: 'user-1' });
    expect(saved.linkedAt).toBeInstanceOf(Date);
    expect(await seed.channelIdentity.getAccountLink(slackKey)).toEqual(saved);
  });

  it('scopes the lookup by every key column', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    expect(await seed.channelIdentity.getAccountLink({ ...slackKey, platform: 'discord' })).toBeNull();
    expect(await seed.channelIdentity.getAccountLink({ ...slackKey, externalTeamId: 'T-other' })).toBeNull();
    expect(await seed.channelIdentity.getAccountLink({ ...slackKey, externalUserId: 'U-other' })).toBeNull();
  });

  it('links a personal account with no org id', async () => {
    const seed = await createFactoryStorageForTests();

    const saved = await seed.channelIdentity.saveAccountLink({ ...slackKey, userId: 'solo-user' });

    expect(saved.userId).toBe('solo-user');
    expect(saved.orgId).toBeUndefined();
    expect(await seed.channelIdentity.getAccountLink(slackKey)).toEqual(saved);
  });

  it('re-links last-write-wins on the same sender key', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });
    const relinked = await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-2', userId: 'user-2' });

    expect(relinked).toMatchObject({ orgId: 'org-2', userId: 'user-2' });
    // Still a single row for the sender — the second write replaced the first.
    expect(await seed.channelIdentity.getAccountLink(slackKey)).toMatchObject({ orgId: 'org-2', userId: 'user-2' });
  });

  it('keeps the same platform user independent across workspaces', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: 'T-work',
      externalUserId: 'U-abc',
      orgId: 'org-work',
      userId: 'user-work',
    });
    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: 'T-personal',
      externalUserId: 'U-abc',
      orgId: 'org-personal',
      userId: 'user-personal',
    });

    expect(
      await seed.channelIdentity.getAccountLink({
        platform: 'slack',
        externalTeamId: 'T-work',
        externalUserId: 'U-abc',
      }),
    ).toMatchObject({ orgId: 'org-work', userId: 'user-work' });
    expect(
      await seed.channelIdentity.getAccountLink({
        platform: 'slack',
        externalTeamId: 'T-personal',
        externalUserId: 'U-abc',
      }),
    ).toMatchObject({ orgId: 'org-personal', userId: 'user-personal' });
  });

  it('deletes a link and reports whether a row was removed', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    expect(await seed.channelIdentity.deleteAccountLink(slackKey)).toBe(true);
    expect(await seed.channelIdentity.getAccountLink(slackKey)).toBeNull();
    // Deleting an already-absent link is a no-op that reports false.
    expect(await seed.channelIdentity.deleteAccountLink(slackKey)).toBe(false);
  });
});
