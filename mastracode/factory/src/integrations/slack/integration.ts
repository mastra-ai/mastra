/**
 * `SlackIntegration` — Slack as a `FactoryIntegration`.
 *
 * Slack contributes two things to a factory: the chat channels that carry
 * inbound messages into agent runs (`channels()`), and the browser-facing
 * account-link routes that bind a Slack sender to a Mastra tenant (`routes()`).
 * Both used to be assembled by hand in the deploy entry, which had to reach
 * into the prepared agent controller by string key, resolve storage domains
 * itself, mint its own state signer, and splice routes onto the factory's
 * assembled server config. Implementing the integration interface instead means
 * the factory does all of that the same way it already does for GitHub and
 * Linear, and the entry's job shrinks to reading Slack's env vars once.
 *
 * Slack ships as a factory built-in alongside GitHub and Linear (it originally
 * lived in `mastracode/web` to keep `@mastra/slack`/`chat` out of this package;
 * the team reversed that so `create-factory` consumers get Slack channels out
 * of the box). The integration interface remains open — third parties still add
 * capabilities by implementing `FactoryIntegration` from outside the package.
 */

import type { TypingStatusFn } from '@mastra/core/channels';
import type { ApiRoute } from '@mastra/core/server';
import type { SlackAdapterChannelConfig } from '@mastra/slack';

import type { WorkItemFeedPublisher } from '../../storage/domains/comments/feed-sync.js';
import type { FactoryChannelsConfig, FactoryIntegration, IntegrationContext } from '../base.js';

import { createSlackConnectRoutes } from './connect-route.js';
import { SlackFeedPublisher } from './feed-publisher.js';
import { createSlackChannelsConfig } from './slack.js';

/**
 * Slack app credentials, read from env ONCE by the deploy entry. `signingSecret`
 * is required because the Slack adapter validates it at construction — an
 * integration constructed without it would throw during `prepare()` rather than
 * reporting itself unconfigured.
 */
export interface SlackIntegrationConfig {
  /** Verifies inbound Slack request signatures. Required. */
  signingSecret: string;
  /** Bot token used to post replies and ephemeral cards. */
  botToken?: string;
  /**
   * OAuth client credentials. Required for account linking: "Sign in with
   * Slack" (OIDC) is the only flow that writes a link, so without these the
   * settings surface reports `canConnect: false` and no sender can link.
   */
  clientId?: string;
  clientSecret?: string;
  /**
   * HTTPS origin Slack redirects back to. Slack requires HTTPS, so locally this
   * is the tunnel origin rather than the app's own public URL.
   */
  oidcRedirectBaseUrl?: string;
  /** SPA origin the post-connect redirect returns to. */
  uiOrigin?: string;
  /**
   * Overrides for the Slack channel adapter entry.
   *
   * @example
   * ```ts
   * new SlackIntegration({
   *   signingSecret,
   *   adapterOptions: {
   *     streaming: true,
   *     toolDisplay: 'grouped',
   *   },
   * });
   * ```
   */
  adapterOptions?: SlackAdapterChannelConfig;
}

const factoryTypingStatus: TypingStatusFn = (chunk, ctx) => {
  switch (chunk.type) {
    case 'reasoning-delta':
      return `is thinking${nextDots(ctx.currentStatus)}`;
    case 'text-delta':
      return 'is typing...';
    case 'tool-call':
      return `is working${nextDots(ctx.currentStatus)}`;
    default:
      return undefined;
  }
};

function nextDots(currentStatus: string | undefined): string {
  const dotCount = currentStatus?.match(/\.*$/)?.[0].length ?? 1;
  return '.'.repeat(dotCount >= 5 ? 2 : dotCount + 1);
}

/**
 * Drops keys the caller set to `undefined` so spreading the overrides cannot
 * erase the Factory defaults they sit on top of.
 */
function adapterOverrides(options: SlackAdapterChannelConfig | undefined): SlackAdapterChannelConfig {
  return Object.fromEntries(
    Object.entries(options ?? {}).filter(([, value]) => value !== undefined),
  ) as SlackAdapterChannelConfig;
}

export class SlackIntegration implements FactoryIntegration {
  readonly id = 'slack';
  /**
   * The OIDC connect flow round-trips a signed `state` through Slack, so the
   * replica handling the callback must be able to verify a state a different
   * replica signed.
   */
  readonly requiresStableStateSigner = true;

  readonly #config: SlackIntegrationConfig;
  /**
   * Whether `channels()` found a source-control owner on the context and wired
   * repo-backed sessions. Set at the channels() attach path, which runs once at
   * boot before diagnostics are served.
   */
  #repoBackedSessions = false;

  constructor(config: SlackIntegrationConfig) {
    if (!config.signingSecret) {
      throw new Error(
        "SlackIntegration: 'signingSecret' is required — Slack cannot verify inbound requests without it.",
      );
    }
    this.#config = config;
  }

  channels(ctx: IntegrationContext): FactoryChannelsConfig {
    // Repo-backed sessions come from the factory's source-control owner
    // (GitHub, when registered) — no config-level wiring by the entry.
    const sourceControlOwner = ctx.storage.sourceControlOwner;
    this.#repoBackedSessions = Boolean(sourceControlOwner);
    return createSlackChannelsConfig({
      slack: {
        clientId: this.#config.clientId,
        clientSecret: this.#config.clientSecret,
        signingSecret: this.#config.signingSecret,
        botToken: this.#config.botToken,
      },
      accountLinks: ctx.storage.channelIdentity,
      projects: ctx.storage.projects,
      sourceControl: sourceControlOwner,
      memorySettings: ctx.storage.memorySettings,
      workItems: ctx.rules?.workItems,
      feed: ctx.feed,
      adapterOptions: {
        toolDisplay: 'hidden',
        typingStatus: factoryTypingStatus,
        ...adapterOverrides(this.#config.adapterOptions),
      },
    });
  }

  feedPublisher(ctx: IntegrationContext): WorkItemFeedPublisher {
    return new SlackFeedPublisher({ controller: ctx.controller });
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    const { clientId, clientSecret, oidcRedirectBaseUrl, uiOrigin } = this.#config;
    return createSlackConnectRoutes({
      auth: ctx.auth,
      accountLinks: ctx.storage.channelIdentity,
      tenantStateSigner: ctx.stateSigner,
      oidc:
        clientId && clientSecret && oidcRedirectBaseUrl
          ? { clientId, clientSecret, redirectBaseUrl: oidcRedirectBaseUrl, uiOrigin }
          : undefined,
      projects: ctx.storage.projects,
    });
  }

  diagnostics(): Record<string, unknown> {
    const { clientId, clientSecret, botToken, oidcRedirectBaseUrl } = this.#config;
    return {
      configured: true,
      botTokenConfigured: Boolean(botToken),
      oidcConfigured: Boolean(clientId && clientSecret && oidcRedirectBaseUrl),
      repoBackedSessions: this.#repoBackedSessions,
    };
  }
}
