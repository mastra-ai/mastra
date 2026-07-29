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
 * This lives in `mastracode/web` rather than in `@mastra/factory` on purpose:
 * it depends on `@mastra/slack` and `chat`, which are mc-web dependencies. The
 * integration interface is explicitly designed to be implemented from outside
 * ("Third parties add capabilities by implementing this same interface — no
 * factory changes required"), so Slack takes that path instead of pushing two
 * chat-platform dependencies into the factory package.
 */

import type { AgentControllerChannels } from '@mastra/core/channels';
import type { ApiRoute } from '@mastra/core/server';
import type { FactoryIntegration, IntegrationContext } from '@mastra/factory';

import { createSlackConnectRoutes } from './connect-route.js';
import { createAgentControllerSlackChannels, createGithubSourceControl } from './slack.js';
import type { SlackSourceControl } from './slack.js';

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
   * OAuth client credentials. Present → the web-initiated "Sign in with Slack"
   * (OIDC) connect flow is enabled; absent → linking is deep-link only.
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
   * Source-control slice that makes new Slack threads repo-backed. Supplied by
   * the entry from the GitHub integration when one is configured; absent →
   * chat-only Slack sessions.
   */
  sourceControl?: SlackSourceControl;
}

export class SlackIntegration implements FactoryIntegration {
  readonly id = 'slack';
  /**
   * The account-link deep link carries a signed `state`, so a replica that
   * didn't sign it must still be able to verify it.
   */
  readonly requiresStableStateSigner = true;

  readonly #config: SlackIntegrationConfig;

  constructor(config: SlackIntegrationConfig) {
    if (!config.signingSecret) {
      throw new Error(
        "SlackIntegration: 'signingSecret' is required — Slack cannot verify inbound requests without it.",
      );
    }
    this.#config = config;
  }

  channels(ctx: IntegrationContext): AgentControllerChannels {
    return createAgentControllerSlackChannels({
      slack: {
        clientId: this.#config.clientId,
        clientSecret: this.#config.clientSecret,
        signingSecret: this.#config.signingSecret,
        botToken: this.#config.botToken,
      },
      accountLinks: ctx.storage.channelIdentity,
      channelLinkStateSigner: ctx.channelLinkStateSigner,
      projects: ctx.storage.projects,
      sourceControl: this.#config.sourceControl,
    });
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    const { clientId, clientSecret, oidcRedirectBaseUrl, uiOrigin } = this.#config;
    return createSlackConnectRoutes({
      auth: ctx.auth,
      accountLinks: ctx.storage.channelIdentity,
      // The factory only omits this when it has no state secret at all, which
      // `requiresStableStateSigner` already fails the boot on.
      channelLinkStateSigner: ctx.channelLinkStateSigner!,
      tenantStateSigner: ctx.stateSigner,
      oidc:
        clientId && clientSecret && oidcRedirectBaseUrl
          ? { clientId, clientSecret, redirectBaseUrl: oidcRedirectBaseUrl, uiOrigin }
          : undefined,
      projects: ctx.storage.projects,
    });
  }

  diagnostics(): Record<string, unknown> {
    const { clientId, clientSecret, botToken, oidcRedirectBaseUrl, sourceControl } = this.#config;
    return {
      configured: true,
      botTokenConfigured: Boolean(botToken),
      oidcConfigured: Boolean(clientId && clientSecret && oidcRedirectBaseUrl),
      repoBackedSessions: Boolean(sourceControl),
    };
  }
}

export { createGithubSourceControl };
