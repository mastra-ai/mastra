import { describe, expect, it } from 'vitest';
import { SNAPSHOT_TTL_MS, hasReconcilableSnapshot, isInviteFlowLive, planReconcile } from './reconcile';
import type { DiscordInstallation } from './types';

const APP_ID = '111111111111111111';
const OTHER_APP_ID = '999999999999999999';
const GUILD = '222222222222222222';
const OTHER_GUILD = '333333333333333333';
const NOW = new Date('2026-10-05T12:00:00Z');

function install(overrides: Partial<DiscordInstallation> & { agentId: string }): DiscordInstallation {
  return {
    id: `install-${overrides.agentId}`,
    webhookId: `webhook-${overrides.agentId}`,
    status: 'pending',
    guildIds: [],
    installedAt: NOW,
    snapshotAt: NOW,
    snapshotApplicationId: APP_ID,
    guildSnapshot: [],
    ...overrides,
  };
}

describe('isInviteFlowLive', () => {
  it('is live for a pending install stamped by the current app inside the TTL', () => {
    expect(isInviteFlowLive(install({ agentId: 'a' }), APP_ID, NOW)).toBe(true);
  });

  it('is live exactly at the TTL boundary and dead one millisecond past it', () => {
    const atBoundary = new Date(NOW.getTime() + SNAPSHOT_TTL_MS);
    const pastBoundary = new Date(NOW.getTime() + SNAPSHOT_TTL_MS + 1);
    expect(isInviteFlowLive(install({ agentId: 'a' }), APP_ID, atBoundary)).toBe(true);
    expect(isInviteFlowLive(install({ agentId: 'a' }), APP_ID, pastBoundary)).toBe(false);
  });

  it('is dead for an active install', () => {
    expect(isInviteFlowLive(install({ agentId: 'a', status: 'active' }), APP_ID, NOW)).toBe(false);
  });

  it('is dead when the snapshot belongs to a different application', () => {
    expect(isInviteFlowLive(install({ agentId: 'a', snapshotApplicationId: OTHER_APP_ID }), APP_ID, NOW)).toBe(false);
  });

  it('is dead for a legacy row without snapshot metadata', () => {
    expect(
      isInviteFlowLive(install({ agentId: 'a', snapshotAt: undefined, snapshotApplicationId: undefined }), APP_ID, NOW),
    ).toBe(false);
  });
});

describe('hasReconcilableSnapshot', () => {
  it('requires a baseline on top of a live flow', () => {
    expect(hasReconcilableSnapshot(install({ agentId: 'a' }), APP_ID, NOW)).toBe(true);
    expect(hasReconcilableSnapshot(install({ agentId: 'a', guildSnapshot: undefined }), APP_ID, NOW)).toBe(false);
  });
});

describe('planReconcile', () => {
  it('attributes a single new, uncontested guild to the install whose baseline misses it', () => {
    const a = install({ agentId: 'a' });
    const plan = planReconcile({ installations: [a], currentGuildIds: [GUILD], applicationId: APP_ID, now: NOW });
    expect(plan).toEqual([{ installationId: a.id, agentId: 'a', webhookId: a.webhookId, guildId: GUILD }]);
  });

  it('activates nothing when the diff is ambiguous (multiple new guilds)', () => {
    const a = install({ agentId: 'a' });
    const plan = planReconcile({
      installations: [a],
      currentGuildIds: [GUILD, OTHER_GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([]);
  });

  it('activates nothing when two live installs contest the same new guild', () => {
    const plan = planReconcile({
      installations: [install({ agentId: 'a' }), install({ agentId: 'b' })],
      currentGuildIds: [GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([]);
  });

  it('never claims a guild another install already owns', () => {
    const owner = install({ agentId: 'owner', status: 'active', guildIds: [GUILD] });
    const plan = planReconcile({
      installations: [install({ agentId: 'a' }), owner],
      currentGuildIds: [GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([]);
  });

  it('activates nothing while any live flow lacks a baseline (unattributable diff)', () => {
    const plan = planReconcile({
      installations: [install({ agentId: 'a' }), install({ agentId: 'b', guildSnapshot: undefined })],
      currentGuildIds: [GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([]);
  });

  it('ignores expired and foreign-app flows entirely — they neither claim nor poison', () => {
    const expired = install({ agentId: 'expired', snapshotAt: new Date(NOW.getTime() - SNAPSHOT_TTL_MS - 1) });
    const foreign = install({ agentId: 'foreign', snapshotApplicationId: OTHER_APP_ID, guildSnapshot: undefined });
    const a = install({ agentId: 'a' });
    const plan = planReconcile({
      installations: [expired, foreign, a],
      currentGuildIds: [GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([{ installationId: a.id, agentId: 'a', webhookId: a.webhookId, guildId: GUILD }]);
  });

  it('narrows a targeted install to its target before tallying claims', () => {
    // `targeted` wants GUILD; `untargeted`'s diff shows GUILD and OTHER_GUILD.
    // Narrowing happens BEFORE the tally: `targeted` claims only GUILD, so it
    // never contests OTHER_GUILD — but `untargeted` still sees two new guilds
    // and stays pending, while `targeted` wins its uncontested target... except
    // GUILD is also in `untargeted`'s diff, making it contested. Verify both.
    const targeted = install({ agentId: 'targeted', targetGuildId: GUILD });
    const untargeted = install({ agentId: 'untargeted' });
    const contested = planReconcile({
      installations: [targeted, untargeted],
      currentGuildIds: [GUILD, OTHER_GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(contested).toEqual([]);

    // With the other flow's baseline already covering GUILD, the target is
    // uncontested and the targeted install activates despite OTHER_GUILD also
    // being new to it — the narrowing removed the ambiguity.
    const covering = install({ agentId: 'untargeted', guildSnapshot: [GUILD, OTHER_GUILD] });
    const plan = planReconcile({
      installations: [targeted, covering],
      currentGuildIds: [GUILD, OTHER_GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([
      { installationId: targeted.id, agentId: 'targeted', webhookId: targeted.webhookId, guildId: GUILD },
    ]);
  });

  it('gives a targeted install nothing when only a different guild appeared', () => {
    const targeted = install({ agentId: 'targeted', targetGuildId: GUILD });
    const plan = planReconcile({
      installations: [targeted],
      currentGuildIds: [OTHER_GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    expect(plan).toEqual([]);
  });

  it('a targeted install still blocks others from claiming its target', () => {
    const targeted = install({ agentId: 'targeted', targetGuildId: GUILD });
    const other = install({ agentId: 'other' });
    const plan = planReconcile({
      installations: [targeted, other],
      currentGuildIds: [GUILD],
      applicationId: APP_ID,
      now: NOW,
    });
    // Both claim GUILD (the targeted one via its narrowed diff) — contested.
    expect(plan).toEqual([]);
  });
});
