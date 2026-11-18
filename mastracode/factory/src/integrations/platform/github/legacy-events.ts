import type { TopicEvent } from '@mastra/connect';

import type { ParsedGithubWebhook } from '../../github/webhook.js';
import type { PlatformTopicEventContext, PlatformTopicSubscription } from '../foundation/index.js';
import {
  deliverGithubEvent,
  githubEventInstallationId,
  githubEventRepositoryId,
  parseGithubEvent,
  withGithubEventInstallation,
} from './events.js';
import type { GithubEventDeliveryConfig } from './events.js';
import type { LinkedGithubRepositories } from './linked-repositories.js';
import type { PlatformGithubModes } from './mode.js';

/** The topic the platform publishes its legacy GitHub App's webhooks to. */
export const LEGACY_GITHUB_TOPIC = 'github-app';
/** Deliveries remembered per process, so a replayed event is not handled twice. */
const RECENT_DELIVERIES_LIMIT = 1_000;

export interface LegacyGithubTopicConfig {
  delivery: GithubEventDeliveryConfig;
  repositories: LinkedGithubRepositories;
  modes: PlatformGithubModes;
  /** Covers what the topic may have missed (first read, or after a gap). */
  reconcile(): void;
  /** A Dependabot alert changed: re-sync alerts soon (requests are debounced). */
  onDependabotAlert?(): void;
}

/**
 * Reads the legacy GitHub App's webhooks from the `github-app` topic. The
 * topic carries every repository the org's installations see, so events for
 * repositories no Factory project links are dropped, as are events for orgs
 * that switched to the Mastra Factory apps, unless the event predates the switch.
 */
export function legacyGithubTopicSubscription(config: LegacyGithubTopicConfig): PlatformTopicSubscription {
  // The events worker is at-least-once: an event whose cursor wasn't saved
  // comes back. Handled deliveries are remembered so the replay is skipped.
  const handled = new Set<string>();
  return {
    topic: LEGACY_GITHUB_TOPIC,
    reconcile: () => config.reconcile(),
    route: async (event: TopicEvent, { logger }: PlatformTopicEventContext) => {
      if (event.fields.kind === 'dependabot_alert') {
        config.onDependabotAlert?.();
        return;
      }
      const parsed = parseLegacyGithubTopicEvent(event);
      if (!parsed) {
        logger?.warn('Platform GitHub: skipped a malformed github-app event', { eventId: event.id });
        return;
      }
      if (handled.has(parsed.deliveryId)) {
        logger?.debug('Platform GitHub: skipped a replayed github-app delivery', { deliveryId: parsed.deliveryId });
        return;
      }
      const accepted = await acceptLegacyGithubEvent(config, parsed, event.timestamp);
      if (accepted.length === 0) {
        logger?.debug('Platform GitHub: github-app event is not for a legacy-mode linked repository', {
          eventId: event.id,
          deliveryId: parsed.deliveryId,
        });
        remember(handled, parsed.deliveryId);
        return;
      }
      for (const delivery of accepted)
        await deliverGithubEvent(config.delivery, delivery.event, delivery.orgIds, logger);
      remember(handled, parsed.deliveryId);
    },
  };
}

export function parseLegacyGithubTopicEvent(event: TopicEvent): ParsedGithubWebhook | null {
  let payload: unknown;
  try {
    payload = JSON.parse(event.fields.payload ?? '');
  } catch {
    return null;
  }
  return parseGithubEvent({ event: event.fields.kind, deliveryId: event.fields.deliveryId, payload });
}

/**
 * The event as Factory should handle it for each set of orgs it is for (none
 * when it isn't Factory's): as published for the orgs still on the legacy app,
 * and re-attributed for each switched org's new installation. A legacy event for an org that switched before the event
 * was published is dropped: the `connect` topic delivers that org's events.
 * One published before the switch still runs, attributed to the
 * `factory-github` installation its repository was re-pointed to.
 */
async function acceptLegacyGithubEvent(
  config: Pick<LegacyGithubTopicConfig, 'repositories' | 'modes'>,
  event: ParsedGithubWebhook,
  timestamp: number,
): Promise<{ event: ParsedGithubWebhook; orgIds: string[] }[]> {
  const repositoryId = githubEventRepositoryId(event);
  const installationId = githubEventInstallationId(event);
  if (repositoryId === undefined || installationId === undefined) return [];
  const deliveries: { event: ParsedGithubWebhook; orgIds: string[] }[] = [];
  const links = await config.repositories.forRepository(repositoryId);

  const legacy = new Set<string>();
  for (const link of links.filter(link => link.installationId === installationId)) {
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode === 'legacy' || (record.switchedAt !== undefined && timestamp < record.switchedAt)) {
        legacy.add(orgId);
      }
    }
  }
  if (legacy.size > 0) deliveries.push({ event, orgIds: [...legacy] });
  for (const link of links.filter(link => link.installationId !== installationId)) {
    const repointed = new Set<string>();
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode !== 'connect' || record.switchedAt === undefined || timestamp >= record.switchedAt) continue;
      const moved = record.installations?.some(
        installation =>
          installation.installationId === link.installationId &&
          installation.legacyInstallationIds?.includes(installationId) === true,
      );
      if (moved) repointed.add(orgId);
    }
    if (repointed.size > 0) {
      // Each copy reaches only its own orgs' projects, whose ingress is keyed per org and project.
      deliveries.push({ event: withGithubEventInstallation(event, link.installationId), orgIds: [...repointed] });
    }
  }
  return deliveries;
}

function remember(keys: Set<string>, key: string): void {
  keys.add(key);
  if (keys.size > RECENT_DELIVERIES_LIMIT) keys.delete(keys.values().next().value!);
}
