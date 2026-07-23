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
