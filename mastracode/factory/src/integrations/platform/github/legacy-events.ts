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
      if (!accepted) {
        logger?.debug('Platform GitHub: github-app event is not for a legacy-mode linked repository', {
          eventId: event.id,
          deliveryId: parsed.deliveryId,
        });
        remember(handled, parsed.deliveryId);
        return;
      }
      await deliverGithubEvent(config.delivery, accepted, logger);
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
 * The event as Factory should handle it, or null when it isn't Factory's. A
 * legacy event for an org that switched before the event was published is
 * dropped: the `connect` topic delivers that org's events. One published
 * before the switch still runs, attributed to the `factory-github`
 * installation its repository was re-pointed to.
 */
async function acceptLegacyGithubEvent(
  config: Pick<LegacyGithubTopicConfig, 'repositories' | 'modes'>,
  event: ParsedGithubWebhook,
  timestamp: number,
): Promise<ParsedGithubWebhook | null> {
  const repositoryId = githubEventRepositoryId(event);
  const installationId = githubEventInstallationId(event);
  if (repositoryId === undefined || installationId === undefined) return null;
  const links = await config.repositories.forRepository(repositoryId);

  for (const link of links.filter(link => link.installationId === installationId)) {
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode === 'legacy' || (record.switchedAt !== undefined && timestamp < record.switchedAt)) return event;
    }
  }
  for (const link of links.filter(link => link.installationId !== installationId)) {
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode !== 'connect' || record.switchedAt === undefined || timestamp >= record.switchedAt) continue;
      const repointed = record.installations?.some(
        installation =>
          installation.installationId === link.installationId && installation.legacyInstallationId === installationId,
      );
      if (repointed) return withGithubEventInstallation(event, link.installationId);
    }
  }
  return null;
}

function remember(keys: Set<string>, key: string): void {
  keys.add(key);
  if (keys.size > RECENT_DELIVERIES_LIMIT) keys.delete(keys.values().next().value!);
}
