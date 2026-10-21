import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

const slackKey = { platform: 'slack', externalTeamId: 'T-123', externalUserId: 'U-abc' };

describe('ChannelIdentityStorage', () => {
  it('resolves display names only for the requested platform, organization, and users', async () => {
    const { channelIdentity } = await createFactoryStorageForTests();
    for (const link of [
      { ...slackKey, orgId: 'org-1', userId: 'user-1', externalUserName: '  Grace Hopper  ' },
      { ...slackKey, externalTeamId: 'T-other', orgId: 'org-2', userId: 'user-1', externalUserName: 'Other org' },
      { ...slackKey, externalTeamId: 'T-personal', userId: 'user-1', externalUserName: 'Personal' },
      { ...slackKey, platform: 'discord', orgId: 'org-1', userId: 'user-1', externalUserName: 'Other platform' },
      { ...slackKey, externalUserId: 'U-other', orgId: 'org-1', userId: 'user-2', externalUserName: 'Other user' },
    ]) {
      await channelIdentity.saveAccountLink(link);
    }
    expect(
      await channelIdentity.getAccountDisplayNames({
        platform: 'slack',
        orgId: 'org-1',
        userIds: ['user-1', 'missing'],
      }),
    ).toEqual(new Map([['user-1', 'Grace Hopper']]));
    expect(await channelIdentity.getAccountDisplayNames({ platform: 'slack', orgId: 'org-1', userIds: [] })).toEqual(
      new Map(),
    );
  });

  it('uses the newest named link and falls back to an older link when the newer one has no name', async () => {
    const { channelIdentity, storage } = await createFactoryStorageForTests();
    for (const [index, name] of ['Older name', 'Current name', '   '].entries()) {
      const key = { ...slackKey, externalTeamId: `T-${index}` };
      await channelIdentity.saveAccountLink({ ...key, orgId: 'org-1', userId: 'user-1', externalUserName: name });
      await storage.ops.updateMany(
        'channel_account_links',
        { platform: key.platform, external_team_id: key.externalTeamId, external_user_id: key.externalUserId },
        { linked_at: new Date(Date.UTC(2026, 0, index + 1)) },
      );
    }
    expect(
      await channelIdentity.getAccountDisplayNames({ platform: 'slack', orgId: 'org-1', userIds: ['user-1'] }),
    ).toEqual(new Map([['user-1', 'Current name']]));
    await channelIdentity.deleteAccountLink({ ...slackKey, externalTeamId: 'T-1' });
    expect(
      await channelIdentity.getAccountDisplayNames({ platform: 'slack', orgId: 'org-1', userIds: ['user-1'] }),
    ).toEqual(new Map([['user-1', 'Older name']]));
  });

  it('finds requested owners beyond the roster limit and across lookup batches', async () => {
    const { channelIdentity } = await createFactoryStorageForTests();
    const names = new Map<string, string>();
    for (let index = 0; index < 205; index++) {
      const userId = `user-${index}`;
      names.set(userId, `Slack owner ${index}`);
      await channelIdentity.saveAccountLink({
        ...slackKey,
        externalUserId: `U-${index}`,
        orgId: 'org-1',
        userId,
        externalUserName: names.get(userId),
      });
    }
    expect(
      await channelIdentity.getAccountDisplayNames({ platform: 'slack', orgId: 'org-1', userIds: [...names.keys()] }),
    ).toEqual(names);
  });

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

  it('lists only the tenant user own links with their sender keys', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });
    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: 'T-two',
      externalUserId: 'U-two',
      userId: 'user-1',
    });
    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: 'T-other',
      externalUserId: 'U-other',
      userId: 'someone-else',
    });

    const links = await seed.channelIdentity.listAccountLinksForUser('user-1');

    expect(links).toHaveLength(2);
    expect(links.map(link => link.externalTeamId).sort()).toEqual(['T-123', 'T-two']);
    expect(links.every(link => link.userId === 'user-1')).toBe(true);
    expect(links.find(link => link.externalTeamId === 'T-123')).toMatchObject({
      platform: 'slack',
      externalUserId: 'U-abc',
      orgId: 'org-1',
    });
  });

  it('stores display names at link time and lists them back', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({
      ...slackKey,
      orgId: 'org-1',
      userId: 'user-1',
      externalTeamName: 'Kepler',
      externalUserName: 'Caleb Barnes',
    });

    const [link] = await seed.channelIdentity.listAccountLinksForUser('user-1');
    expect(link).toMatchObject({ externalTeamName: 'Kepler', externalUserName: 'Caleb Barnes' });

    // Names are optional — a nameless save (legacy card path) omits them.
    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });
    const [relinked] = await seed.channelIdentity.listAccountLinksForUser('user-1');
    expect(relinked?.externalTeamName).toBeUndefined();
    expect(relinked?.externalUserName).toBeUndefined();
  });

  it('sets, reads back, and clears the default factory on an own link', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    // Unset by default.
    expect((await seed.channelIdentity.getAccountLink(slackKey))?.defaultFactoryProjectId).toBeUndefined();

    expect(
      await seed.channelIdentity.setDefaultFactory({ ...slackKey, userId: 'user-1', factoryProjectId: 'fp-1' }),
    ).toBe(true);
    expect((await seed.channelIdentity.getAccountLink(slackKey))?.defaultFactoryProjectId).toBe('fp-1');
    // Listed entries carry it too (settings surface).
    const [entry] = await seed.channelIdentity.listAccountLinksForUser('user-1');
    expect(entry?.defaultFactoryProjectId).toBe('fp-1');

    // Clear with null.
    expect(
      await seed.channelIdentity.setDefaultFactory({ ...slackKey, userId: 'user-1', factoryProjectId: null }),
    ).toBe(true);
    expect((await seed.channelIdentity.getAccountLink(slackKey))?.defaultFactoryProjectId).toBeUndefined();
  });

  it('setDefaultFactory cannot repoint another tenant link', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    expect(
      await seed.channelIdentity.setDefaultFactory({ ...slackKey, userId: 'intruder', factoryProjectId: 'fp-evil' }),
    ).toBe(false);
    expect((await seed.channelIdentity.getAccountLink(slackKey))?.defaultFactoryProjectId).toBeUndefined();
  });

  it('re-link keeps the stored default factory', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });
    await seed.channelIdentity.setDefaultFactory({ ...slackKey, userId: 'user-1', factoryProjectId: 'fp-1' });

    // Re-link (e.g. OIDC again) omits the default column — it must survive.
    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    expect((await seed.channelIdentity.getAccountLink(slackKey))?.defaultFactoryProjectId).toBe('fp-1');
  });

  it('self-service delete cannot sever another tenant link', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.channelIdentity.saveAccountLink({ ...slackKey, orgId: 'org-1', userId: 'user-1' });

    // Another user addressing the same sender key deletes nothing.
    expect(await seed.channelIdentity.deleteAccountLinkForUser({ ...slackKey, userId: 'intruder' })).toBe(false);
    expect(await seed.channelIdentity.getAccountLink(slackKey)).not.toBeNull();

    // The owner can sever it.
    expect(await seed.channelIdentity.deleteAccountLinkForUser({ ...slackKey, userId: 'user-1' })).toBe(true);
    expect(await seed.channelIdentity.getAccountLink(slackKey)).toBeNull();
  });
});
