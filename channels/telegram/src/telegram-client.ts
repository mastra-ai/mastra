import { randomBytes } from 'node:crypto';
import type { TelegramUser } from '@chat-adapter/telegram';
import { TELEGRAM_API_BASE_URL } from './types';
import type { BotCommand } from './types';

/**
 * Minimal Telegram Bot API response envelope. The adapter keeps its own copy
 * internally; this local shape covers just what the provider's control-plane
 * calls (`getMe`, `setWebhook`, `deleteWebhook`, and later `setMyCommands`) need.
 * @see https://core.telegram.org/bots/api#making-requests
 */
interface TelegramApiResponse<TResult> {
  ok: boolean;
  result?: TResult;
  description?: string;
  error_code?: number;
}

/**
 * Call a Bot API method. Sends a `GET` when `payload` is omitted and a JSON
 * `POST` otherwise. Throws when the transport fails or the API returns
 * `ok: false`.
 */
async function botApiRequest<TResult>(
  botToken: string,
  method: string,
  apiBaseUrl: string,
  payload?: Record<string, unknown>,
): Promise<TResult> {
  const init: RequestInit | undefined =
    payload === undefined
      ? undefined
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/bot${botToken}/${method}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    // Tag transport/timeout failures so callers can tell them apart from an
    // `ok: false` API response (see getMe).
    throw Object.assign(new Error(`Telegram ${method} request failed`, { cause }), {
      isTransportError: true,
    });
  }
  const body = (await response.json().catch(() => null)) as TelegramApiResponse<TResult> | null;
  if (!response.ok || !body?.ok) {
    const detail = body?.description ?? `HTTP ${response.status}`;
    throw new Error(`Telegram ${method} failed: ${detail}`);
  }
  return body.result as TResult;
}

/**
 * Validate a bot token via `getMe` and resolve the bot's identity. Throws if
 * the token is rejected or the returned user is not a bot.
 *
 * @see https://core.telegram.org/bots/api#getme
 */
export async function getMe(botToken: string, apiBaseUrl: string = TELEGRAM_API_BASE_URL): Promise<TelegramUser> {
  let result: TelegramUser;
  try {
    result = await botApiRequest<TelegramUser>(botToken, 'getMe', apiBaseUrl);
  } catch (cause) {
    // A transport/timeout failure is a connectivity problem, not a token
    // rejection — surface it as-is rather than mislabeling it as a bad token.
    if (cause instanceof Error && (cause as { isTransportError?: boolean }).isTransportError) {
      throw cause;
    }
    throw new Error(`Telegram rejected the bot token: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
  }
  if (!result?.is_bot) {
    throw new Error('Telegram getMe returned a non-bot user; expected a BotFather token');
  }
  return result;
}

/** Options for {@link setWebhook}. */
export interface SetWebhookOptions {
  /** Public HTTPS URL Telegram will POST updates to. */
  url: string;
  /** Shared secret echoed back as `X-Telegram-Bot-Api-Secret-Token` on every POST. */
  secretToken: string;
  /** Update types to receive. Note: `message_reaction` must be listed explicitly. */
  allowedUpdates?: string[];
  /** Drop the backlog of updates queued while the bot was offline. */
  dropPendingUpdates?: boolean;
}

/**
 * Register a per-bot webhook. Setting a webhook disables `getUpdates`
 * (long-polling) for that bot — the two transports are mutually exclusive.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export async function setWebhook(
  botToken: string,
  options: SetWebhookOptions,
  apiBaseUrl: string = TELEGRAM_API_BASE_URL,
): Promise<void> {
  await botApiRequest<boolean>(botToken, 'setWebhook', apiBaseUrl, {
    url: options.url,
    secret_token: options.secretToken,
    allowed_updates: options.allowedUpdates,
    drop_pending_updates: options.dropPendingUpdates,
  });
}

/**
 * Remove a bot's webhook. Required before switching a bot to long-polling
 * (`getUpdates` fails while a webhook is set).
 *
 * @see https://core.telegram.org/bots/api#deletewebhook
 */
export async function deleteWebhook(
  botToken: string,
  dropPendingUpdates: boolean = false,
  apiBaseUrl: string = TELEGRAM_API_BASE_URL,
): Promise<void> {
  await botApiRequest<boolean>(botToken, 'deleteWebhook', apiBaseUrl, {
    drop_pending_updates: dropPendingUpdates,
  });
}

/** Options for {@link setMyCommands}. */
export interface SetMyCommandsOptions {
  /** The command list to publish (replaces the existing set for the scope). */
  commands: BotCommand[];
  /** Command scope (e.g. `{ type: 'all_private_chats' }`). Omit for the default scope. */
  scope?: Record<string, unknown>;
  /** Two-letter language code for a localized command set. */
  languageCode?: string;
}

/**
 * Publish the bot's command list for a scope.
 *
 * @see https://core.telegram.org/bots/api#setmycommands
 */
export async function setMyCommands(
  botToken: string,
  options: SetMyCommandsOptions,
  apiBaseUrl: string = TELEGRAM_API_BASE_URL,
): Promise<void> {
  await botApiRequest<boolean>(botToken, 'setMyCommands', apiBaseUrl, {
    commands: options.commands,
    scope: options.scope,
    language_code: options.languageCode,
  });
}

/**
 * Generate a webhook secret token within Telegram's `setWebhook` constraint:
 * 1-256 chars from `[A-Za-z0-9_-]`. base64url of 32 random bytes yields 43
 * such chars.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export function generateSecretToken(): string {
  return randomBytes(32).toString('base64url');
}
