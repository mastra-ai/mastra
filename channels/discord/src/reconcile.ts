import type { DiscordInstallation } from './types';

/**
 * How long a pending install's {@link DiscordInstallation.guildSnapshot} stays
 * eligible for reconciliation after the invite flow (re)started. Past this
 * window the baseline is stale evidence: the operator has plainly abandoned
 * the Connect flow, and a guild the bot joins days later (for any reason) must
 * not be attributed to it. An expired install still activates normally via its
 * first interaction.
 */
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

/** One activation the reconcile pass decided on (see {@link planReconcile}). */
export interface ReconcileActivation {
  installationId: string;
  agentId: string;
  webhookId: string;
  /** The single new, uncontested guild attributed to this install's invite. */
  guildId: string;
}

/**
 * Whether an install's invite flow is still *live*: started against the
 * current application and within {@link SNAPSHOT_TTL_MS}. Deliberately
 * independent of whether the baseline fetch succeeded — a live flow with a
 * missing baseline still poisons attribution (see {@link planReconcile}),
 * while rows from before these fields existed (no `snapshotAt`) are treated
 * as not live and fall back to first-interaction activation.
 */
export function isInviteFlowLive(
  installation: Pick<DiscordInstallation, 'status' | 'snapshotAt' | 'snapshotApplicationId'>,
  applicationId: string,
  now: Date,
): boolean {
  return (
    installation.status === 'pending' &&
    installation.snapshotApplicationId === applicationId &&
    installation.snapshotAt != null &&
    now.getTime() - installation.snapshotAt.getTime() <= SNAPSHOT_TTL_MS
  );
}

/**
 * Whether a pending install can reconcile at all: a live invite flow (see
 * {@link isInviteFlowLive}) *with* a membership baseline to diff against.
 * Used as a cheap pre-check before the membership fetch.
 */
export function hasReconcilableSnapshot(installation: DiscordInstallation, applicationId: string, now: Date): boolean {
  return installation.guildSnapshot != null && isInviteFlowLive(installation, applicationId, now);
}

/**
 * Decide which pending installs the completed-invite reconcile pass may
 * activate, and on which guild. Pure claim analysis over plain data — all
 * store reads, membership fetches, and activations happen in the caller
 * ({@link DiscordProvider.reconcileInstallation}).
 *
 * Rules, in order:
 * - Only installs with a live invite flow ({@link isInviteFlowLive}) take part.
 *   Expired/foreign-app baselines are ignored (first interaction remains their
 *   activation path), as are legacy rows without snapshot metadata.
 * - A live flow whose baseline fetch failed at connect time poisons the whole
 *   pass: any new guild might be ITS invite landing, so nothing is attributed.
 * - A guild any install already lists is owned and never claimed — it can
 *   still look "new" relative to a stale baseline.
 * - An install with an explicit {@link DiscordInstallation.targetGuildId}
 *   claims *only* that guild. The narrowing happens before claims are tallied,
 *   so a targeted install never contests a guild it would refuse anyway — but
 *   its target, if new, still blocks other installs from taking it.
 * - An install activates only on exactly one new guild, claimed by no other
 *   live install. Zero or multiple candidates, or a contested guild, stay
 *   pending and retry on the next pass.
 */
export function planReconcile(input: {
  installations: DiscordInstallation[];
  /** The bot's complete current guild membership. */
  currentGuildIds: string[];
  /** The application the membership was fetched for. */
  applicationId: string;
  now: Date;
}): ReconcileActivation[] {
  const { installations, currentGuildIds, applicationId, now } = input;

  const live = installations.filter(i => isInviteFlowLive(i, applicationId, now));
  const claimants = live.filter(i => i.guildSnapshot != null);
  if (claimants.length === 0) return [];
  if (claimants.length !== live.length) return []; // live flow without a baseline — unattributable

  const owned = new Set(installations.flatMap(i => i.guildIds));

  const diffs = claimants.map(installation => {
    const snapshot = new Set(installation.guildSnapshot);
    let newGuilds = currentGuildIds.filter(id => !snapshot.has(id) && !owned.has(id));
    if (installation.targetGuildId != null) {
      newGuilds = newGuilds.includes(installation.targetGuildId) ? [installation.targetGuildId] : [];
    }
    return { installation, newGuilds };
  });

  const claims = new Map<string, number>();
  for (const { newGuilds } of diffs) {
    for (const id of newGuilds) claims.set(id, (claims.get(id) ?? 0) + 1);
  }

  const activations: ReconcileActivation[] = [];
  for (const { installation, newGuilds } of diffs) {
    const guildId = newGuilds.length === 1 ? newGuilds[0] : undefined;
    if (guildId == null || claims.get(guildId)! > 1) continue; // ambiguous — wait for an interaction
    activations.push({
      installationId: installation.id,
      agentId: installation.agentId,
      webhookId: installation.webhookId,
      guildId,
    });
  }
  return activations;
}
