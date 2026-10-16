import type { Adapter } from 'chat';

/**
 * Result of a compat avatar-sync attempt for a channel adapter that does not
 * itself implement {@link AvatarSyncCapableAdapter}.
 *
 * - `handled: true` — the compat layer recognized the adapter and attempted the
 *   sync (which may have succeeded or thrown; a thrown error surfaces via the
 *   caller's try/catch and lands in `syncedChannels[].error`).
 * - `handled: false` — the platform is not one Mastra can sync via a public
 *   API (e.g. Slack bot avatars are set in the app dashboard only, Telegram
 *   uses BotFather commands, Teams has no bot-avatar API), or the adapter did
 *   not expose a shape we know how to talk to.
 */
export type PlatformAvatarSyncResult = { handled: true } | { handled: false; reason: string };

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

/** Duck-typed shape of a discord.js `Client` exposed by common Discord adapters. */
type DiscordJsClient = {
  user?: {
    setAvatar: (avatar: Buffer | string) => Promise<unknown>;
  } | null;
};

/** Duck-typed shape of a discord.js `REST` client. */
type DiscordRest = {
  patch: (route: string, options: { body: Record<string, unknown> }) => Promise<unknown>;
};

type MaybeDiscordAdapter = {
  client?: DiscordJsClient | null;
  rest?: DiscordRest | null;
};

function bytesToDataUri(bytes: Buffer, mime: string): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/**
 * Try to update the bot's avatar on Discord.
 *
 * Discord bots CAN update their own avatar via `PATCH /users/@me` (the same
 * endpoint discord.js `client.user.setAvatar` wraps). We support both shapes.
 */
async function syncDiscordAvatar(
  adapter: Adapter<any, any>,
  bytes: Buffer,
  mime: string,
): Promise<PlatformAvatarSyncResult> {
  const a = adapter as unknown as MaybeDiscordAdapter;

  // Prefer the high-level discord.js API when the adapter exposes its Client.
  const user = a.client?.user;
  if (user && typeof user.setAvatar === 'function') {
    await user.setAvatar(bytes);
    return { handled: true };
  }

  // Fall back to the low-level REST client if exposed.
  if (a.rest && typeof a.rest.patch === 'function') {
    await a.rest.patch('/users/@me', { body: { avatar: bytesToDataUri(bytes, mime) } });
    return { handled: true };
  }

  return { handled: false, reason: 'discord adapter did not expose client.user.setAvatar or rest.patch' };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Attempt a platform-native avatar sync for an adapter that does not
 * implement {@link AvatarSyncCapableAdapter} directly.
 *
 * Called by `agent.setAvatar()` as a fallback so users get automatic sync for
 * built-in adapters without any adapter-side code change. Adapters that DO
 * implement `setAvatar` take precedence and this function is not invoked.
 *
 * Currently supported:
 * - `discord` — via `client.user.setAvatar` (discord.js) or `rest.patch('/users/@me')`.
 *
 * Explicitly unsupported (documented so the reason surfaces in logs):
 * - `slack` — bot avatars are managed in the Slack app configuration dashboard, not via the Web API.
 * - `telegram` — bot avatars are set via `@BotFather` commands, not the Bot API.
 * - `teams`, `gchat`, `google-chat` — no public bot-avatar update API.
 */
export async function applyPlatformAvatarSync(
  platform: string,
  adapter: Adapter<any, any>,
  bytes: Buffer,
  mime: string,
): Promise<PlatformAvatarSyncResult> {
  switch (platform) {
    case 'discord':
      return syncDiscordAvatar(adapter, bytes, mime);
    case 'slack':
      return {
        handled: false,
        reason: 'slack bot avatars can only be updated in the Slack app configuration dashboard',
      };
    case 'telegram':
      return { handled: false, reason: 'telegram bot avatars can only be updated via @BotFather' };
    case 'teams':
    case 'gchat':
    case 'google-chat':
      return { handled: false, reason: `${platform} does not expose a public bot-avatar update API` };
    default:
      return { handled: false, reason: `no built-in avatar sync for platform '${platform}'` };
  }
}
