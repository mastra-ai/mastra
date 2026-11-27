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

import { ChannelToolAnnouncementProcessor, createChannelAttachFileTool } from '@mastra/core/channels';
import type { AgentChannels } from '@mastra/core/channels';
import type { OutputProcessor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type { SlackAdapterChannelConfig } from '@mastra/slack';

import type { FactoryChannelsConfig, FactoryIntegration, IntegrationContext, IntegrationTools } from '../base.js';
import { parseCreatedPullRequest } from '../github/session-subscriptions.js';
import { factoryReplyInstructions, SESSION_LINK_LABEL } from './channel-reply-processor.js';
import { sessionLinkFromRequest } from './channel-session-link-processor.js';
import { createSlackChatTools } from './chat-tools.js';
import { createSlackConnectRoutes } from './connect-route.js';
import { slackThreadOf } from './slack-thread.js';
import type { SlackThreadDeps } from './slack-thread.js';
import { createSlackChannelsConfig } from './slack.js';
import { DEFAULT_SLACK_TOOL_SETTINGS, slackToolSettingsSchema } from './tool-settings.js';
import type { SlackToolSettings } from './tool-settings.js';

/** Slack app credentials, read from env ONCE by the deploy entry. */
export interface SlackIntegrationConfig {
  /** Slack event transport. Defaults to webhook mode. */
  mode?: 'webhook' | 'socket';
  /** Verifies inbound Slack request signatures. Required in webhook mode. */
  signingSecret?: string;
  /** App-level token used to connect to Slack. Required in socket mode. */
  appToken?: string;
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
  /**
   * What sessions started from Slack may do with the Slack tools. By default a
   * session can read and post only in its own channel, and can't send DMs.
   *
   * @example
   * ```ts
   * new SlackIntegration({
   *   signingSecret,
   *   // Any channel the app is in, and DMs to anyone in the workspace.
   *   tools: { channels: 'all', directMessages: 'anyone' },
   * });
   * ```
   */
  tools?: Partial<SlackToolSettings>;
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

/**
 * Core's reply mode, under the caller's overrides. Tool calls stay out of the
 * thread: a Factory session runs hundreds of them, and a row per call (or a
 * card per call) buries the reply. Progress shows through the typing status
 * instead, which names the tool's current step; the session link carries the
 * full trace. `grouped` remains available via `adapterOptions` for callers
 * who want Slack's "Thinking Steps" widget.
 */
const FACTORY_REPLY_OPTIONS: Pick<SlackAdapterChannelConfig, 'replyMode' | 'threadLink'> = {
  replyMode: { instructions: factoryReplyInstructions },
  threadLink: { label: SESSION_LINK_LABEL, link: ({ requestContext }) => sessionLinkFromRequest(requestContext) },
};

export class SlackIntegration implements FactoryIntegration {
  readonly id = 'slack';
  /**
   * The OIDC connect flow round-trips a signed `state` through Slack, so the
   * replica handling the callback must be able to verify a state a different
   * replica signed.
   */
  readonly requiresStableStateSigner = true;

  readonly #config: SlackIntegrationConfig;
  readonly #toolSettings: SlackToolSettings;
  readonly #adapterOptions: SlackAdapterChannelConfig;
  /** Posts pull requests the agent opens to the session's Slack thread. */
  readonly processors: { output: OutputProcessor[] };
  /** Bound in `initialize()`; the controller mounts after integrations are built. */
  #channels: SlackThreadDeps['channels'];
  readonly #deps: SlackThreadDeps = { channels: () => this.#channels?.() };
  /**
   * Whether `channels()` found a source-control owner on the context and wired
   * repo-backed sessions. Set at the channels() attach path, which runs once at
   * boot before diagnostics are served.
   */
  #repoBackedSessions = false;

  constructor(config: SlackIntegrationConfig) {
    const mode = config.mode ?? 'webhook';
    if (mode === 'webhook' && !config.signingSecret) {
      throw new Error(
        "SlackIntegration: 'signingSecret' is required in webhook mode — Slack cannot verify inbound requests without it.",
      );
    }
    if (mode === 'socket' && !config.appToken) {
      throw new Error(
        "SlackIntegration: 'appToken' is required in socket mode — Slack cannot open a Socket Mode connection without it.",
      );
    }
    if (mode === 'socket' && !config.botToken) {
      throw new Error("SlackIntegration: 'botToken' is required in socket mode — Factory cannot reply without it.");
    }
    this.#config = config;
    // An explicit `undefined` means "use the default", not "unset it".
    const granted = Object.fromEntries(Object.entries(config.tools ?? {}).filter(([, value]) => value !== undefined));
    this.#toolSettings = slackToolSettingsSchema.parse({ ...DEFAULT_SLACK_TOOL_SETTINGS, ...granted });
    const overrides = adapterOverrides(config.adapterOptions);
    this.#adapterOptions = { ...FACTORY_REPLY_OPTIONS, ...overrides };
    this.processors = {
      output: [
        new ChannelToolAnnouncementProcessor({
          channels: this.#deps.channels,
          announce: ({ toolName, args, result }) => {
            const url = parseCreatedPullRequest({ toolName, input: args, output: result });
            return url ? `Pull request opened: ${url}` : undefined;
          },
        }),
      ],
    };
  }

  initialize(args: { channels?: () => AgentChannels | null | undefined }): void {
    this.#channels = args.channels;
  }

  /**
   * On runs whose session is linked to a Slack thread: `attach_file` and the
   * Slack read, post,
   * search, lookup and DM tools. The tools find the thread to post into when
   * they are called.
   */
  async agentTools({ requestContext }: { requestContext: RequestContext }): Promise<IntegrationTools> {
    const slackThread = await slackThreadOf(requestContext, this.#deps);
    if (!slackThread) return {};
    const chat = this.#channels?.()?.sdk;
    const sessionThreadId = slackThread.threadId;
    return {
      ...createChannelAttachFileTool(requestContext, this.#deps),
      ...(chat && sessionThreadId
        ? await createSlackChatTools({ chat, sessionThreadId, settings: this.#toolSettings })
        : {}),
    };
  }

  channels(ctx: IntegrationContext): FactoryChannelsConfig {
    // Repo-backed sessions select the source-control provider from the linked
    // repository on each Factory project.
    const sourceControls =
      ctx.storage.sourceControls ?? (ctx.storage.sourceControlOwner ? [ctx.storage.sourceControlOwner] : []);
    this.#repoBackedSessions = sourceControls.length > 0;
    const mode = this.#config.mode ?? 'webhook';
    return createSlackChannelsConfig({
      slack: {
        mode: this.#config.mode,
        ...(mode === 'webhook' ? { clientId: this.#config.clientId, clientSecret: this.#config.clientSecret } : {}),
        signingSecret: this.#config.signingSecret,
        appToken: this.#config.appToken,
        botToken: this.#config.botToken,
      },
      accountLinks: ctx.storage.channelIdentity,
      projects: ctx.storage.projects,
      sourceControls,
      modelDefaults: ctx.storage.modelDefaults,
      modelCredentials: ctx.storage.modelCredentials,
      voiceSettings: ctx.storage.voiceSettings,
      workItems: ctx.runtime?.workItems,
      adapterOptions: this.#adapterOptions,
    });
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
