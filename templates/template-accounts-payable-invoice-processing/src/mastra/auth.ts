import { RequestContext } from '@mastra/core/request-context';
import { SimpleAuth } from '@mastra/core/server';
import { isIP } from 'node:net';

export type ApUser = { id: string; name: string; role: 'ap_approver' | 'viewer' };
const configuredToken = process.env.MASTRA_AUTH_TOKEN?.trim(),
  configuredUserId = process.env.MASTRA_AUTH_USER_ID?.trim();

export const serverHost = process.env.MASTRA_HOST?.trim() || '127.0.0.1';

export function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    (isIP(normalized) === 4 && normalized.startsWith('127.'))
  );
}

export const authConfigurationError =
  Boolean(configuredToken) !== Boolean(configuredUserId)
    ? 'Set both MASTRA_AUTH_TOKEN and MASTRA_AUTH_USER_ID, or leave both unset'
    : undefined;

export function isLocalFixtureDemo() {
  const isDevelopment =
    process.env.MASTRA_DEV === 'true' ||
    process.env.MASTRA_DEV === '1' ||
    (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'prod');
  return (
    !configuredToken &&
    !configuredUserId &&
    isDevelopment &&
    isLoopbackHost(serverHost) &&
    (process.env.ACCOUNTING_PROVIDER?.trim() || 'fixture') === 'fixture'
  );
}

export const apAuth =
  configuredToken && configuredUserId
    ? new SimpleAuth<ApUser>({
        tokens: {
          [configuredToken]: {
            id: configuredUserId,
            name: configuredUserId,
            role: 'ap_approver',
          },
        },
        protected: ['/api/*'],
      })
    : undefined;

export async function getCurrentApUser(request: Request): Promise<ApUser | null> {
  if (apAuth) return apAuth.getCurrentUser(request);
  if (isLocalFixtureDemo())
    return {
      id: 'local-reviewer',
      name: 'Local reviewer',
      role: 'ap_approver',
    };
  return null;
}

export function setAuthenticatedReviewer(requestContext: RequestContext<any>, user: ApUser | null) {
  requestContext.delete('reviewerId');
  if (user?.role === 'ap_approver') requestContext.set('reviewerId', user.id);
}
