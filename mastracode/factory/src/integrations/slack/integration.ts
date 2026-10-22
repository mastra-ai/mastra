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

import { REPLY_TOOL_NAME } from '../../session/reply-tool.js';
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

/** Slack renders the status inline next to the app name; keep it to one short line. */
const MAX_STATUS_LENGTH = 80;

/**
 * Turns a tool's `description` arg ("Listing the repo root") into a status
 * line that reads after the app name ("<App> is listing the repo root…").
 * Only the first line counts: issue/PR creators carry whole bodies there.
 */
function describeToolCall(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const { description } = args as { description?: unknown };
  if (typeof description !== 'string') return undefined;
  const line = description
    .split('\n')
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  if (!line) return undefined;
  const text = line.length > MAX_STATUS_LENGTH ? `${line.slice(0, MAX_STATUS_LENGTH - 1)}…` : line;
  // Drop the sentence-case capital ("Listing" → "listing") but leave acronyms
  // and identifiers ("PR lookup", "CI status") alone.
  return `is ${/^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text}`;
}

/**
 * With reply text hidden, streamed text never reaches the thread, so it gets
 * no status: an "is typing..." set after the reply tool's post would sit on
 * the thread with nothing coming, and race the clear at the end of the run.
 */
const factoryTypingStatus =
  (textDisplay: SlackAdapterChannelConfig['textDisplay']): TypingStatusFn =>
  chunk => {
  switch (chunk.type) {
    case 'reasoning-delta':
      return 'is thinking...';
    case 'text-delta':
      return textDisplay === 'hidden' ? undefined : 'is typing...';
    // The reply tool's text streams into the thread as the model writes it.
    case 'tool-call-input-streaming-start':
      return chunk.payload.toolName === REPLY_TOOL_NAME ? 'is typing...' : undefined;
    case 'tool-call':
      return describeToolCall(chunk.payload.args) ?? 'is working...';
    default:
      return undefined;
  }
};

/**
 * Drops keys the caller set to `undefined` so spreading the overrides cannot
 * erase the Factory defaults they sit on top of.
 */
function adapterOverrides(options: SlackAdapterChannelConfig | undefined): SlackAdapterChannelConfig {
  return Object.fromEntries(
    Object.entries(options ?? {}).filter(([, value]) => value !== undefined),
  ) as SlackAdapterChannelConfig;
}

/**
 * Factory defaults under the caller's overrides. Tool calls stay out of the
 * thread: a Factory session runs hundreds of them, and a row per call (or a
 * card per call) buries the reply. Progress shows through the typing status
 * instead, which names the tool's current step; the session link carries the
 * full trace. `grouped` remains available via `adapterOptions` for callers
 * who want Slack's "Thinking Steps" widget.
 */
function factoryAdapterOptions(overrides: SlackAdapterChannelConfig): SlackAdapterChannelConfig {
  const textDisplay = overrides.textDisplay ?? 'hidden';
  return { typingStatus: factoryTypingStatus(textDisplay), toolDisplay: 'hidden', textDisplay, ...overrides };
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
    // Repo-backed sessions select the source-control provider from the linked
    // repository on each Factory project.
    const sourceControls =
      ctx.storage.sourceControls ?? (ctx.storage.sourceControlOwner ? [ctx.storage.sourceControlOwner] : []);
    this.#repoBackedSessions = sourceControls.length > 0;
    return createSlackChannelsConfig({
      slack: {
        clientId: this.#config.clientId,
        clientSecret: this.#config.clientSecret,
        signingSecret: this.#config.signingSecret,
        botToken: this.#config.botToken,
      },
      accountLinks: ctx.storage.channelIdentity,
      projects: ctx.storage.projects,
      sourceControls,
      modelDefaults: ctx.storage.modelDefaults,
      workItems: ctx.runtime?.workItems,
      feed: ctx.feed,
      adapterOptions: factoryAdapterOptions(adapterOverrides(this.#config.adapterOptions)),
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
