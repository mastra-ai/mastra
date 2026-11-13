import type { ParsedGithubWebhook } from '../../github/webhook.js';
import type { PlatformConnectEventDelivery } from '../foundation/index.js';
import { deliverGithubEvent, githubEventInstallationId, githubEventRepositoryId, parseGithubEvent } from './events.js';
import type { GithubEventDeliveryConfig, GithubEventLogger } from './events.js';
import type { LinkedGithubRepositories } from './linked-repositories.js';
import type { PlatformGithubModes } from './mode.js';

/** The Connect provider whose installation serves an org's GitHub after its switch. */
export const FACTORY_GITHUB_PROVIDER_KEY = 'factory-github';
/** The Connect provider for reviews. Factory needs none of its events. */
export const FACTORY_REVIEWS_GITHUB_PROVIDER_KEY = 'factory-reviews-github';
const RECENT_DELIVERIES_LIMIT = 1_000;

export interface ConnectGithubEventsConfig {
  delivery: GithubEventDeliveryConfig;
  repositories: LinkedGithubRepositories;
  modes: PlatformGithubModes;
  /** A Dependabot alert changed: re-sync alerts soon (requests are debounced). */
  onDependabotAlert?(): void;
  logger?: GithubEventLogger;
}

/**
 * Handles `factory-github` webhooks from the `connect` topic, for orgs that
 * switched to the Mastra Factory apps. Events from before an org's switch are
 * the `github-app` topic's; events the platform couldn't verify are never
 * acted on.
 */
export function connectGithubEventHandler(
  config: ConnectGithubEventsConfig,
): (event: PlatformConnectEventDelivery) => Promise<void> {
  const handled = new Set<string>();
  return async event => {
    const logger = config.logger;
    if (event.integrationId !== FACTORY_GITHUB_PROVIDER_KEY) {
      logger?.debug('Platform GitHub: ignored a connect event from another GitHub app', {
        eventId: event.id,
        integrationId: event.integrationId,
      });
      return;
    }
    if (event.unverified) {
      logger?.warn('Platform GitHub: dropped an unverified factory-github event', {
        eventId: event.id,
        eventType: event.eventType,
      });
      return;
    }
    const name = event.eventType.split('.')[0];
    if (name === 'dependabot_alert') {
      config.onDependabotAlert?.();
      return;
    }
    const parsed = event.payloadParseError
      ? null
      : parseGithubEvent({ event: name, deliveryId: event.dedupeKey, payload: event.payload });
    if (!parsed) {
      logger?.debug('Platform GitHub: skipped a factory-github event Factory does not handle', {
        eventId: event.id,
        eventType: event.eventType,
      });
      return;
    }
    const key = `github:${parsed.deliveryId}`;
    if (handled.has(key)) {
      logger?.debug('Platform GitHub: skipped a replayed factory-github delivery', { deliveryId: parsed.deliveryId });
      return;
    }
    if (!(await acceptConnectGithubEvent(config, parsed, event.connectionId, event.timestamp))) {
      logger?.debug('Platform GitHub: factory-github event is not for a switched org’s linked repository', {
        eventId: event.id,
        deliveryId: parsed.deliveryId,
      });
      remember(handled, key);
      return;
    }
    await deliverGithubEvent(config.delivery, parsed, logger);
    remember(handled, key);
  };
}

/**
 * Whether a linked repository of an org that switched to the installation the
 * event came through, by the connection serving that installation, wants it.
 */
async function acceptConnectGithubEvent(
  config: Pick<ConnectGithubEventsConfig, 'repositories' | 'modes'>,
  event: ParsedGithubWebhook,
  connectionId: string,
  timestamp: number,
): Promise<boolean> {
  const repositoryId = githubEventRepositoryId(event);
  const installationId = githubEventInstallationId(event);
  if (repositoryId === undefined || installationId === undefined) return false;
  for (const link of await config.repositories.forRepository(repositoryId)) {
    if (link.installationId !== installationId) continue;
    for (const orgId of link.orgIds) {
      const record = await config.modes.get(orgId);
      if (record.mode !== 'connect' || record.switchedAt === undefined || timestamp < record.switchedAt) continue;
      const serves = record.installations?.some(
        installation => installation.installationId === installationId && installation.connectionId === connectionId,
      );
      if (serves) return true;
    }
  }
  return false;
}

function remember(keys: Set<string>, key: string): void {
  keys.add(key);
  if (keys.size > RECENT_DELIVERIES_LIMIT) keys.delete(keys.values().next().value!);
}
