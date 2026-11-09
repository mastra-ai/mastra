import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/**
 * Resolves the Discord bot token from the connection's credentials. Nango's
 * `discord` provider is API_KEY-typed and stores the bot token as its
 * secret, so the platform serves it back as `credentials.apiKey` (the wire
 * shape templates are written against). Throws a ToolActionError with a
 * consistent `missing_credentials` payload so exec bodies don't need to repeat
 * the guard.
 */
export async function resolveDiscordBotToken(platformProxy: PlatformProxy): Promise<string> {
  const connection = await platformProxy.getConnectionWithCredentials();
  const credentials = connection.credentials as Record<string, unknown> | undefined;
  if (credentials && typeof credentials.apiKey === 'string' && credentials.apiKey) {
    return credentials.apiKey;
  }
  throw new platformProxy.ActionError({
    type: 'missing_credentials',
    message:
      'Discord bot token is missing from the connection credentials. Reconnect the discord integration with a valid bot token.',
  });
}
