import {
  DEFAULT_INVITE_PERMISSIONS,
  DEFAULT_INVITE_SCOPES,
  DISCORD_API_BASE_URL,
  DISCORD_OAUTH_AUTHORIZE_URL,
} from './types';
import type { DiscordCommand } from './types';

/** `CHAT_INPUT` (slash) application command type. */
const APPLICATION_COMMAND_TYPE_CHAT_INPUT = 1;

/** Per-request ceiling for control-plane calls, so a hung API can't stall the provider. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The subset of Discord's application object the control plane reads back from
 * `GET /applications/@me`.
 * @see https://discord.com/developers/docs/resources/application#application-object
 */
export interface DiscordApplication {
  /** The application (client) id. */
  id: string;
  /** The application's name. */
  name: string;
}

/** Minimal Discord REST error envelope. */
interface DiscordErrorBody {
  message?: string;
  code?: number;
}

/**
 * Call the Discord REST API with Bot-token auth. Sends a `GET` when `body` is
 * omitted and a JSON request (default `POST`) otherwise. Returns the raw
 * {@link Response} so callers can distinguish membership (2xx) from
 * "not a member" (403/404) without treating the latter as an error.
 *
 * This is the **control plane only** — validating the app and reading guild
 * membership. Sending replies uses the interaction token inside the adapter,
 * never this bot-token path.
 */
export async function discordRequest(
  botToken: string,
  method: string,
  path: string,
  apiBaseUrl: string = DISCORD_API_BASE_URL,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bot ${botToken}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  try {
    // Bound every control-plane call: without a timeout a hung Discord API
    // blocks connect()/disconnect()/#registerCommands() indefinitely, since no
    // call site in discord-provider.ts imposes one of its own.
    return await fetch(`${apiBaseUrl}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (cause) {
    throw new Error(`Discord ${method} ${path} request failed`, { cause });
  }
}

/** Read a Discord error description from a non-2xx response, best-effort. */
async function describeError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as DiscordErrorBody | null;
  return body?.message ?? `HTTP ${response.status}`;
}

/**
 * Validate the app's bot token and resolve the application identity via
 * `GET /applications/@me` (Bot auth). Throws if the token is rejected.
 *
 * @see https://discord.com/developers/docs/resources/application#get-current-application
 */
export async function validateApp(
  botToken: string,
  apiBaseUrl: string = DISCORD_API_BASE_URL,
): Promise<DiscordApplication> {
  const response = await discordRequest(botToken, 'GET', '/applications/@me', apiBaseUrl);
  if (!response.ok) {
    throw new Error(`Discord rejected the bot token: ${await describeError(response)}`);
  }
  const app = (await response.json()) as DiscordApplication;
  if (!app?.id) {
    throw new Error('Discord /applications/@me returned no application id');
  }
  return app;
}

/**
 * Whether the bot is already a member of a guild. `GET /guilds/{id}` (Bot auth)
 * returns `200` only when the bot is in the guild; `403`/`404` mean it is not.
 * Lets `connect()` bind immediately (bot present) vs. issue an invite (absent).
 *
 * @see https://discord.com/developers/docs/resources/guild#get-guild
 */
export async function guildHealthCheck(
  botToken: string,
  guildId: string,
  apiBaseUrl: string = DISCORD_API_BASE_URL,
): Promise<boolean> {
  const response = await discordRequest(botToken, 'GET', `/guilds/${guildId}`, apiBaseUrl);
  // Drain the body so the connection can be reused (undici keep-alive).
  await response.body?.cancel().catch(() => {});
  return response.ok;
}

/** Map normalized commands to the Discord bulk-overwrite `CHAT_INPUT` payload. */
function toCommandPayload(commands: readonly DiscordCommand[]) {
  return commands.map(c => ({
    name: c.name,
    description: c.description,
    type: APPLICATION_COMMAND_TYPE_CHAT_INPUT,
  }));
}

/**
 * Bulk-overwrite a **guild's** slash commands (`PUT …/guilds/{guildId}/commands`).
 * Guild-scoped commands update **instantly**. Register on first-seen guild;
 * callers skip the call when the command hash is unchanged (200 creates/day/guild).
 *
 * @see https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-guild-application-commands
 */
export async function registerGuildCommands(
  botToken: string,
  applicationId: string,
  guildId: string,
  commands: readonly DiscordCommand[],
  apiBaseUrl: string = DISCORD_API_BASE_URL,
): Promise<void> {
  const path = `/applications/${applicationId}/guilds/${guildId}/commands`;
  const response = await discordRequest(botToken, 'PUT', path, apiBaseUrl, toCommandPayload(commands));
  if (!response.ok) {
    throw new Error(`Discord guild command registration failed: ${await describeError(response)}`);
  }
  await response.body?.cancel().catch(() => {});
}

/**
 * Bulk-overwrite the app's **global** slash commands (`PUT …/commands`).
 * Eventually consistent (propagation is not instant — don't quote a fixed
 * number). Opt-in via `commandScope: 'global'`.
 *
 * @see https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
 */
export async function registerGlobalCommands(
  botToken: string,
  applicationId: string,
  commands: readonly DiscordCommand[],
  apiBaseUrl: string = DISCORD_API_BASE_URL,
): Promise<void> {
  const path = `/applications/${applicationId}/commands`;
  const response = await discordRequest(botToken, 'PUT', path, apiBaseUrl, toCommandPayload(commands));
  if (!response.ok) {
    throw new Error(`Discord global command registration failed: ${await describeError(response)}`);
  }
  await response.body?.cancel().catch(() => {});
}

/** Inputs for {@link buildInviteUrl}. */
export interface BuildInviteUrlOptions {
  /** The application (client) id — becomes `client_id`. */
  applicationId: string;
  /** Permissions bitfield (bigint or decimal string). Defaults to {@link DEFAULT_INVITE_PERMISSIONS}. */
  permissions?: bigint | string;
  /** OAuth2 scopes. Defaults to {@link DEFAULT_INVITE_SCOPES} (`bot applications.commands`). */
  scopes?: readonly string[];
}

/**
 * Build the OAuth2 bot-invite URL. This *is* the Discord "install" flow: the
 * operator opens it, picks a guild, and authorizes — there is no token exchange.
 * `scope=bot applications.commands` + a `permissions` bitfield.
 *
 * @see https://discord.com/developers/docs/topics/oauth2#bot-authorization-flow
 */
export function buildInviteUrl(options: BuildInviteUrlOptions): string {
  const permissions = (options.permissions ?? DEFAULT_INVITE_PERMISSIONS).toString();
  const scopes = options.scopes ?? DEFAULT_INVITE_SCOPES;
  const url = new URL(DISCORD_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', options.applicationId);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('permissions', permissions);
  return url.toString();
}
