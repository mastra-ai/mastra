import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

const baseKey = {
  orgId: 'org-1',
  userId: 'user-1',
  integrationId: 'github',
  externalUserId: 'octocat',
};

describe('IntegrationIdentityStorage', () => {
  it('lists nothing before any claim is made', async () => {
    const seed = await createFactoryStorageForTests();

    expect(await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' })).toEqual([]);
  });

  it('claims an external account and reads it back by user', async () => {
    const seed = await createFactoryStorageForTests();

    const claim = await seed.integrationIdentity.upsert({
      ...baseKey,
      label: 'Octocat',
      email: 'octocat@example.com',
    });

    expect(claim).toMatchObject({
      orgId: 'org-1',
      userId: 'user-1',
      integrationId: 'github',
      externalUserId: 'octocat',
      label: 'Octocat',
      email: 'octocat@example.com',
      source: 'self-claim',
    });
    expect(claim.claimedAt).toBeInstanceOf(Date);

    const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(claim);
  });

  it('rejects an empty label at the boundary', async () => {
    const seed = await createFactoryStorageForTests();

    await expect(seed.integrationIdentity.upsert({ ...baseKey, label: '' })).rejects.toThrow(/label/);
    await expect(seed.integrationIdentity.upsert({ ...baseKey, label: '   ' })).rejects.toThrow(/label/);
  });

  it('stores email as absent (not empty string) when omitted', async () => {
    const seed = await createFactoryStorageForTests();

    const claim = await seed.integrationIdentity.upsert({ ...baseKey, label: 'Octocat' });

    expect(claim.email).toBeUndefined();
    const [listed] = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    expect(listed?.email).toBeUndefined();
  });

  it('enforces uniqueness on the quadruple (last-write-wins refresh)', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.integrationIdentity.upsert({ ...baseKey, label: 'Octocat' });
    // Wait a tick so claimed_at can move forward.
    await new Promise(resolve => setTimeout(resolve, 5));
    const refreshed = await seed.integrationIdentity.upsert({
      ...baseKey,
      label: 'Octo the Cat',
      email: 'octo@example.com',
    });

    // Still a single row for the quadruple, refreshed metadata and timestamp.
    const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    expect(listed).toHaveLength(1);
    expect(refreshed.label).toBe('Octo the Cat');
    expect(refreshed.email).toBe('octo@example.com');
    expect(refreshed.claimedAt.getTime()).toBeGreaterThanOrEqual(first.claimedAt.getTime());
  });

  it('lets one user claim multiple accounts on the same integration', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({ ...baseKey, externalUserId: 'octocat', label: 'Octocat' });
    await seed.integrationIdentity.upsert({ ...baseKey, externalUserId: 'octobot', label: 'Octobot' });

    const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    expect(listed.map(claim => claim.externalUserId).sort()).toEqual(['octobot', 'octocat']);
  });

  it('lists claims across multiple integrations for the same user', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({
      ...baseKey,
      integrationId: 'github',
      externalUserId: 'octocat',
      label: 'Octocat',
    });
    await seed.integrationIdentity.upsert({
      ...baseKey,
      integrationId: 'linear',
      externalUserId: 'linear-user-42',
      label: 'Ada Lovelace',
    });
    await seed.integrationIdentity.upsert({
      ...baseKey,
      integrationId: 'jira',
      externalUserId: 'jira-account-99',
      label: 'Ada L.',
      email: 'ada@example.com',
    });

    const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    const byIntegration = new Map(listed.map(claim => [claim.integrationId, claim]));
    expect(byIntegration.get('github')?.externalUserId).toBe('octocat');
    expect(byIntegration.get('linear')?.externalUserId).toBe('linear-user-42');
    expect(byIntegration.get('jira')?.externalUserId).toBe('jira-account-99');
    expect(byIntegration.get('jira')?.email).toBe('ada@example.com');
  });

  it('scopes claims by org (same user in two orgs is two independent claim sets)', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({ ...baseKey, orgId: 'org-1', label: 'Octocat @ Org 1' });
    await seed.integrationIdentity.upsert({ ...baseKey, orgId: 'org-2', label: 'Octocat @ Org 2' });

    const org1 = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    const org2 = await seed.integrationIdentity.listByUser({ orgId: 'org-2', userId: 'user-1' });
    expect(org1).toHaveLength(1);
    expect(org2).toHaveLength(1);
    expect(org1[0]?.label).toBe('Octocat @ Org 1');
    expect(org2[0]?.label).toBe('Octocat @ Org 2');
  });

  it('reverse-looks up every user who claimed the same external account', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({ ...baseKey, userId: 'user-1', label: 'Octocat' });
    await seed.integrationIdentity.upsert({ ...baseKey, userId: 'user-2', label: 'Octocat (shared bot)' });
    // Different external account, must not appear.
    await seed.integrationIdentity.upsert({ ...baseKey, userId: 'user-3', externalUserId: 'other', label: 'Other' });

    const claimants = await seed.integrationIdentity.listByExternalUser({
      orgId: 'org-1',
      integrationId: 'github',
      externalUserId: 'octocat',
    });
    expect(claimants.map(claim => claim.userId).sort()).toEqual(['user-1', 'user-2']);
  });

  it('does not bleed reverse lookups across orgs or integrations', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({ ...baseKey, orgId: 'org-1', integrationId: 'github', label: 'Octocat' });
    await seed.integrationIdentity.upsert({ ...baseKey, orgId: 'org-2', integrationId: 'github', label: 'Octocat' });
    await seed.integrationIdentity.upsert({ ...baseKey, orgId: 'org-1', integrationId: 'linear', label: 'Octocat' });

    const githubOrg1 = await seed.integrationIdentity.listByExternalUser({
      orgId: 'org-1',
      integrationId: 'github',
      externalUserId: 'octocat',
    });
    expect(githubOrg1).toHaveLength(1);
    expect(githubOrg1[0]?.orgId).toBe('org-1');
    expect(githubOrg1[0]?.integrationId).toBe('github');
  });

  it('removes a claim by key and no longer lists it', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.integrationIdentity.upsert({ ...baseKey, label: 'Octocat' });
    await seed.integrationIdentity.upsert({ ...baseKey, externalUserId: 'octobot', label: 'Octobot' });

    expect(await seed.integrationIdentity.remove(baseKey)).toBe(true);
    const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.externalUserId).toBe('octobot');
  });

  it('is idempotent when removing a non-existent claim', async () => {
    const seed = await createFactoryStorageForTests();

    expect(await seed.integrationIdentity.remove(baseKey)).toBe(false);
    // A second remove on a still-absent row also returns false, not an error.
    expect(await seed.integrationIdentity.remove(baseKey)).toBe(false);
  });
});
