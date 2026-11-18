import type { ParsedGithubWebhook } from '../../github/webhook.js';
import {
  deliverGithubEvent,
  githubEventInstallationId,
  githubEventRepositoryId,
  parseGithubEvent,
  withGithubEventInstallation,
} from './events.js';
import type { GithubEventDeliveryConfig, GithubEventLogger } from './events.js';
import type { LinkedGithubRepositories } from './linked-repositories.js';
import type { PlatformGithubModes } from './mode.js';

/** Deliveries remembered per process, so a replayed event is not handled twice. */
const RECENT_DELIVERIES_LIMIT = 1_000;

/** One legacy GitHub App webhook, as read from a repository's platform event log. */
export interface LegacyGithubEvent {
  /** The event log's id for it. */
  id: string;
  /** When the platform received it, in Unix milliseconds. */
  timestamp: number;
  /** The GitHub event name (`X-GitHub-Event`). */
  event: string;
  deliveryId: string;
  payload: unknown;
}

export interface LegacyGithubEventsConfig {
  delivery: GithubEventDeliveryConfig;
  repositories: LinkedGithubRepositories;
  modes: PlatformGithubModes;
  /** A Dependabot alert changed: re-sync alerts soon (requests are debounced). */
  onDependabotAlert?(): void;
  /**
   * A pre-switch event reached an org that has since switched. It may land
   * after the switch's reconcile, so reconcile again (requests are debounced).
   */
  onLateSwitchedOrgEvent?(): void;
}

/**
 * Handles the legacy GitHub App's webhooks. Events for repositories no Factory
 * project links are dropped, as are events for orgs that switched to the
 * Mastra Factory apps, unless the event predates the switch. A failed
 * delivery throws, so the caller can retry it.
 */
export function legacyGithubEventHandler(
  config: LegacyGithubEventsConfig,
): (event: LegacyGithubEvent, logger?: GithubEventLogger) => Promise<void> {
  // Delivery is at-least-once: an event whose cursor wasn't saved comes back.
  // Handled deliveries are remembered so the replay is skipped.
  const handled = new Set<string>();
  return async (event, logger) => {
    if (event.event === 'dependabot_alert') {
      config.onDependabotAlert?.();
      return;
    }
    const parsed = parseGithubEvent({ event: event.event, deliveryId: event.deliveryId, payload: event.payload });
    if (!parsed) {
      logger?.warn('Platform GitHub: skipped a malformed legacy GitHub App event', { eventId: event.id });
      return;
    }
    if (handled.has(parsed.deliveryId)) {
      logger?.debug('Platform GitHub: skipped a replayed legacy GitHub App delivery', {
        deliveryId: parsed.deliveryId,
      });
      return;
    }
    const accepted = await acceptLegacyGithubEvent(config, parsed, event.timestamp);
    if (accepted.length === 0) {
      logger?.debug('Platform GitHub: legacy GitHub App event is not for a legacy-mode linked repository', {
        eventId: event.id,
        deliveryId: parsed.deliveryId,
      });
      remember(handled, parsed.deliveryId);
      return;
    }
    for (const delivery of accepted) await deliverGithubEvent(config.delivery, delivery.event, delivery.orgIds, logger);
    remember(handled, parsed.deliveryId);
    if (accepted.some(delivery => delivery.late)) config.onLateSwitchedOrgEvent?.();
  };
}

/**
 * The event as Factory should handle it for each set of orgs it is for (none
 * when it isn't Factory's): as published for the orgs still on the legacy app,
 * and re-attributed for each switched org's new installation. A legacy event for an org that switched before the event
 * was published is dropped: its `factory-github` connection delivers that org's events.
 * One published before the switch still runs, attributed to the
 * `factory-github` installation its repository was re-pointed to.
 */
async function acceptLegacyGithubEvent(
  config: Pick<LegacyGithubEventsConfig, 'repositories' | 'modes'>,
  event: ParsedGithubWebhook,
  timestamp: number,
): Promise<{ event: ParsedGithubWebhook; orgIds: string[]; late: boolean }[]> {
  const repositoryId = githubEventRepositoryId(event);
  const installationId = githubEventInstallationId(event);
  if (repositoryId === undefined || installationId === undefined) return [];
  const deliveries: { event: ParsedGithubWebhook; orgIds: string[]; late: boolean }[] = [];
  const links = await config.repositories.forRepository(repositoryId);

  const legacy = new Set<string>();
  let late = false;
  for (const link of links.filter(link => link.installationId === installationId)) {
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode === 'legacy') {
        legacy.add(orgId);
      } else if (record.switchedAt !== undefined && timestamp < record.switchedAt) {
        legacy.add(orgId);
        late = true;
      }
    }
  }
  if (legacy.size > 0) deliveries.push({ event, orgIds: [...legacy], late });
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
      deliveries.push({
        event: withGithubEventInstallation(event, link.installationId),
        orgIds: [...repointed],
        late: true,
      });
    }
  }
  return deliveries;
}

function remember(keys: Set<string>, key: string): void {
  keys.add(key);
  if (keys.size > RECENT_DELIVERIES_LIMIT) keys.delete(keys.values().next().value!);
}
