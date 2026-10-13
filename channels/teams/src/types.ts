import type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandlers,
  StreamingConfig,
  WaitUntilFn,
} from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { TeamsAdapterConfig } from '@chat-adapter/teams';

/** Microsoft Graph origin used for Entra application provisioning. */
export const GRAPH_API_BASE_URL = 'https://graph.microsoft.com';

/** Teams Developer Portal origin used for Bot Framework registrations. */
export const DEV_PORTAL_BASE_URL = 'https://dev.teams.microsoft.com';

/** Microsoft login origin used to validate bot credentials (client-credentials mint). */
export const LOGIN_BASE_URL = 'https://login.microsoftonline.com';

/**
 * OAuth scope for Microsoft Graph control-plane calls (create Entra apps,
 * mint client secrets). Passed to the delegated {@link TeamsTokenResolver}.
 */
export const TEAMS_GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

/**
 * OAuth scope for the Teams Developer Portal API (bot registrations).
 * Tokens for this audience are distinct from Graph tokens — a single access
 * token cannot serve both APIs. Passed to the delegated
 * {@link TeamsTokenResolver}.
 */
export const TEAMS_DEV_PORTAL_SCOPE = 'https://dev.teams.microsoft.com/AppDefinitions.ReadWrite';

/**
 * Teams Developer Portal page where minted bot registrations are managed and
 * packaged into a Teams app for distribution.
 */
export const DEV_PORTAL_BOTS_URL = 'https://dev.teams.microsoft.com/bots';

/**
 * Resolve an access token for a Microsoft OAuth scope on demand.
 *
 * Teams provisioning spans two token audiences — Microsoft Graph
 * ({@link TEAMS_GRAPH_SCOPE}) for Entra application management and the Teams
 * Developer Portal ({@link TEAMS_DEV_PORTAL_SCOPE}) for bot registrations — so
 * unlike the Slack/Telegram resolvers this one is scope-aware: the provider
 * passes the scope it needs and the resolver returns a token minted for that
 * audience.
 */
export type TeamsTokenResolver = (scope: string | string[], tenantId?: string) => Promise<string>;

/**
 * Self-managed credentials: bring your own Azure Bot registration. The
 * Microsoft App ID / password are supplied directly (provider defaults and/or
 * per-`connect()`) and persisted in the install store. Mutually exclusive with
 * {@link TeamsDelegatedCredentialsConfig}.
 */
export interface TeamsSelfManagedCredentialsConfig {
  /** Microsoft App (client) ID of an existing bot registration. */
  appId?: string;
  /** Client secret for {@link appId}. */
  appPassword?: string;
  tokenResolver?: never;
}

/**
 * Delegated credentials: an external credential manager (e.g. the Mastra
 * platform) owns a *manager* credential that can provision bots. The provider
 * calls the resolver with the scope it needs ({@link TEAMS_GRAPH_SCOPE} or
 * {@link TEAMS_DEV_PORTAL_SCOPE}) during `connect()`/`disconnect()` to mint
 * per-agent Entra applications and Developer Portal bot registrations.
 *
 * The manager credential is used only at provisioning time. Each provisioned
 * bot gets its own client secret, stored (encrypted) in the install store, and
 * the runtime authenticates with Bot Framework using that per-agent secret —
 * no manager-credential round-trip on the message path.
 *
 * Mutually exclusive with direct `appId`/`appPassword` credentials.
 */
export interface TeamsDelegatedCredentialsConfig {
  /** Resolve a manager access token for the given Microsoft OAuth scope. */
  tokenResolver: TeamsTokenResolver;
  appId?: never;
  appPassword?: never;
}

/**
 * How the provider obtains bot credentials: either directly
 * (`appId`/`appPassword`, self-managed) or by provisioning per-agent bots via
 * a scope-aware `tokenResolver` (delegated) — never both.
 */
export type TeamsCredentialsConfig = TeamsSelfManagedCredentialsConfig | TeamsDelegatedCredentialsConfig;

/**
 * Configuration for {@link TeamsProvider}.
 */
export interface TeamsProviderConfigBase {
  /**
   * Public HTTPS base URL used as the bot messaging endpoint
   * (`{baseUrl}/teams/events/{webhookId}`). May be omitted and auto-detected
   * from the Mastra server config.
   */
  baseUrl?: string;
  /**
   * Persistence for bot installations. Defaults to Mastra's channels storage
   * when available, falling back to an in-memory store (dev/test only).
   */
  storage?: ChannelsStorage;
  /**
   * Passphrase for encrypting the per-bot client secret at rest (AES-256-GCM).
   * Defaults to the `MASTRA_ENCRYPTION_KEY` env var.
   */
  encryptionKey?: string;
  /** Entra tenant ID for single-tenant bots. */
  appTenantId?: string;
  /**
   * Bot application audience. Provisioned (delegated) bots default to
   * `MultiTenant`.
   * @default 'MultiTenant'
   */
  appType?: 'MultiTenant' | 'SingleTenant';
  /** Override the Bot Framework service URL (e.g. sovereign clouds). Forwarded to the adapter. */
  apiUrl?: string;
  /** Override Microsoft Graph origin (tests / sovereign clouds). @default 'https://graph.microsoft.com' */
  graphBaseUrl?: string;
  /** Override the Teams Developer Portal origin (tests). @default 'https://dev.teams.microsoft.com' */
  devPortalBaseUrl?: string;
  /** Override the Microsoft login origin used for credential validation (tests). @default 'https://login.microsoftonline.com' */
  loginBaseUrl?: string;
  /** Icon URL recorded on provisioned bot registrations. */
  botIconUrl?: string;
  /**
   * Keep the serverless invocation alive while the agent stream runs after the
   * webhook returns 200. See `ChannelConfig.waitUntil`.
   */
  waitUntil?: WaitUntilFn;
  /**
   * Stream agent text to Teams as it generates (native Teams streaming in DMs,
   * post-and-edit elsewhere — handled by the adapter).
   * @default true
   */
  streaming?: StreamingConfig;
  /**
   * Keep a typing indicator alive during generation.
   * @default true
   */
  typingStatus?: boolean;

  // ---------------------------------------------------------------------------
  // AgentChannels passthrough — a curated subset of `ChannelConfig` /
  // `ChannelAdapterConfig` forwarded to every agent connected via this
  // provider, mirroring `@mastra/slack` / `@mastra/telegram`.
  // ---------------------------------------------------------------------------

  /** Override built-in event handlers. Forwarded to `AgentChannels`. */
  handlers?: ChannelHandlers;
  /** Which media types to send inline to the model. See `ChannelConfig.inlineMedia`. */
  inlineMedia?: ChannelConfig['inlineMedia'];
  /** Promote URLs in message text to file parts. See `ChannelConfig.inlineLinks`. */
  inlineLinks?: ChannelConfig['inlineLinks'];
  /** State adapter for deduplication, locking, and subscriptions. See `ChannelConfig.state`. */
  state?: ChannelConfig['state'];
  /** Fetch recent thread messages when the agent joins mid-conversation. See `ChannelConfig.threadContext`. */
  threadContext?: ChannelConfig['threadContext'];
  /** Additional options passed directly to the Chat SDK. See `ChannelConfig.chatOptions`. */
  chatOptions?: ChannelConfig['chatOptions'];
  /** Resolve the memory `resourceId` before a channel thread is created. See `ChannelConfig.resolveResourceId`. */
  resolveResourceId?: ChannelConfig['resolveResourceId'];
  /** Resolve `waitUntil` from the request's Hono `Context`. See `ChannelConfig.resolveWaitUntil`. */
  resolveWaitUntil?: ChannelConfig['resolveWaitUntil'];
  /** CORS configuration for the generated Teams webhook route. */
  cors?: ChannelAdapterConfig['cors'];
  /** Override how errors are rendered in Teams messages. See `ChannelAdapterConfig.formatError`. */
  formatError?: ChannelAdapterConfig['formatError'];
  /** How tool calls are rendered in the reply. See `ChannelAdapterConfig.toolDisplay`. */
  toolDisplay?: ChannelAdapterConfig['toolDisplay'];
  /** Whether to expose channel reaction tools to the agent. See `ChannelConfig.tools`. */
  tools?: ChannelConfig['tools'];
  /** Logger forwarded to the underlying `TeamsAdapter`. */
  logger?: TeamsAdapterConfig['logger'];
  /** Called after an agent successfully connects and the installation is persisted. */
  onInstall?: (installation: TeamsInstallation) => void | Promise<void>;
}

/** See {@link TeamsProviderConfigBase} and {@link TeamsCredentialsConfig}. */
export type TeamsProviderConfig = TeamsProviderConfigBase & TeamsCredentialsConfig;

/** Options accepted by {@link TeamsProvider.connect}. */
export interface TeamsConnectOptions {
  /** Display name for the bot. Defaults to the agent id. */
  name?: string;
  /**
   * Microsoft App (client) ID of an existing bot registration (self-managed
   * mode). Falls back to the provider-level `appId`. Rejected in delegated
   * mode, where bots are provisioned per agent.
   */
  appId?: string;
  /** Client secret for {@link appId} (self-managed mode). Falls back to the provider-level `appPassword`. */
  appPassword?: string;
  /** Entra tenant ID for single-tenant bots. Falls back to the provider-level `appTenantId`. */
  appTenantId?: string;
}

/**
 * A Teams bot bound to a single agent (one bot = one agent).
 * Persisted through {@link TeamsInstallStore}.
 */
export interface TeamsInstallation {
  /** Stable installation id. */
  id: string;
  /** The agent this bot is bound to. */
  agentId: string;
  /**
   * Opaque id embedded in the messaging endpoint path
   * (`/teams/events/:webhookId`). Inbound requests are authenticated by
   * Microsoft's JWT signature (verified by the adapter), not by this id.
   */
  webhookId: string;
  /** Whether the bot is provisioned/validated and routable. */
  status: 'active' | 'pending';
  /** Microsoft App (client) ID of the bot. */
  appId?: string;
  /**
   * Entra application **object id** — only set for bots this provider
   * provisioned (delegated mode); used to delete the application on
   * disconnect.
   */
  entraObjectId?: string;
  /** Client secret the bot authenticates to Bot Framework with (encrypted at rest). */
  appPassword?: string;
  /** Entra tenant ID for single-tenant bots. */
  appTenantId?: string;
  /** Bot application audience. */
  appType?: 'MultiTenant' | 'SingleTenant';
  /** Display name of the bot. */
  botName?: string;
  /** The messaging endpoint registered for the bot. */
  messagingEndpoint?: string;
  /** When the installation was created. */
  installedAt: Date;
}
