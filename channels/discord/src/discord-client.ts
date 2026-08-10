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
 * Call the Discord REST API with Bot-token auth. `method` is required; supplying
 * `body` adds the JSON `content-type` header and serializes the payload. Returns
 * the raw {@link Response} so callers can classify the status themselves rather
 * than having every non-2xx collapse into a thrown error.
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
 * returns `200` only when the bot is in the guild. Absence is `404` (`10004
 * Unknown Guild`) — Discord standardized on 404 rather than 403 so the response
 * can't confirm a guild exists to a caller that lacks access — with legacy
 * deployments still answering `403` (`50001 Missing Access`).
 *
 * Any **other** failure (`401`, `429`, `5xx`) is a transient or auth problem,
 * not evidence of absence, and throws. Collapsing those into `false` would send
 * a caller whose bot *is* in the guild down the invite path on a rate limit.
 *
 * @see https://discord.com/developers/docs/resources/guild#get-guild
 */
export async function guildHealthCheck(
  botToken: string,
  guildId: string,
  apiBaseUrl: string = DISCORD_API_BASE_URL,
): Promise<boolean> {
  const response = await discordRequest(botToken, 'GET', `/guilds/${guildId}`, apiBaseUrl);
  if (response.ok) {
    // Drain the body so the connection can be reused (undici keep-alive).
    await response.body?.cancel().catch(() => {});
    return true;
  }
  if (response.status === 404 || response.status === 403) {
    await response.body?.cancel().catch(() => {});
    return false;
  }
  throw new Error(`Discord guild lookup failed for "${guildId}": ${await describeError(response)}`);
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
 * Longest `Retry-After` we will wait out inline before giving up. Registration
 * is best-effort at the call site, so a long bucket is better surfaced as an
 * error than held open.
 */
const MAX_RETRY_AFTER_MS = 5_000;

/**
 * `PUT` a bulk command overwrite, retrying **once** if Discord rate-limits it.
 *
 * Discord returns the wait in the `retry_after` body field (seconds, may be
 * fractional) and the `Retry-After` header. The value is dynamic, so it is read
 * from the response rather than assumed.
 *
 * @see https://discord.com/developers/docs/topics/rate-limits
 */
async function bulkOverwriteCommands(
  botToken: string,
  path: string,
  commands: readonly DiscordCommand[],
  apiBaseUrl: string,
  scopeLabel: string,
): Promise<void> {
  const payload = toCommandPayload(commands);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await discordRequest(botToken, 'PUT', path, apiBaseUrl, payload);
    if (response.ok) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    if (response.status === 429 && attempt === 0) {
      const body = (await response.json().catch(() => null)) as { retry_after?: number; message?: string } | null;
      const headerSeconds = Number(response.headers.get('retry-after'));
      const seconds = body?.retry_after ?? (Number.isFinite(headerSeconds) ? headerSeconds : 0);
      const waitMs = Math.ceil(seconds * 1000);
      if (waitMs > 0 && waitMs <= MAX_RETRY_AFTER_MS) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw new Error(
        `Discord ${scopeLabel} command registration was rate-limited; retry after ${seconds}s: ${body?.message ?? `HTTP ${response.status}`}`,
      );
    }
    throw new Error(`Discord ${scopeLabel} command registration failed: ${await describeError(response)}`);
  }
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
  await bulkOverwriteCommands(botToken, path, commands, apiBaseUrl, 'guild');
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
  await bulkOverwriteCommands(botToken, path, commands, apiBaseUrl, 'global');
}

/** Inputs for {@link buildInviteUrl}. */
export interface BuildInviteUrlOptions {
  /** The application (client) id — becomes `client_id`. */
  applicationId: string;
  /** Permissions bitfield (bigint or decimal string). Defaults to {@link DEFAULT_INVITE_PERMISSIONS}. */
  permissions?: bigint | string;
  /** OAuth2 scopes. Defaults to {@link DEFAULT_INVITE_SCOPES} (`bot applications.commands`). */
  scopes?: readonly string[];
  /**
   * Preselect this guild in the authorize screen and lock the picker, so the
   * operator can't authorize a different guild than the one `connect()` recorded.
   */
  guildId?: string;
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
  if (options.guildId) {
    // Preselect and lock the picker so the authorized guild matches the one the
    // install was recorded against.
    url.searchParams.set('guild_id', options.guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
}
