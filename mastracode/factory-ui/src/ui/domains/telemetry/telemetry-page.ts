import { FACTORY_WEB_PAGES } from '@mastra/factory/telemetry-types';
import type { FactoryWebActivity } from '@mastra/factory/telemetry-types';

/** Only known screen categories cross the network, never route parameters. */
export function telemetryPage(pathname: string): FactoryWebActivity['page'] | undefined {
  if (pathname === '/onboarding') return 'onboarding';
  const match = /^\/factories\/[^/]+\/(.+?)\/?$/.exec(pathname);
  if (!match) return undefined;
  const screen = match[1];
  if (screen === 'settings/connections/slack') return 'slack_connection';
  if (/^settings\/[^/]+$/.test(screen)) return 'settings';
  if (/^workspaces\/[^/]+\/threads\/[^/]+$/.test(screen) || /^user\/threads\/[^/]+$/.test(screen)) return 'thread';
  if (/^workspaces\/[^/]+$/.test(screen)) return 'workspace';
  if (screen === 'new') return 'new_session';
  if (screen === 'new-factory') return 'new_factory';
  // These are redirects or categories represented by the patterns above.
  if (
    ['onboarding', 'settings', 'workspace', 'thread', 'slack_connection', 'new_session', 'new_factory'].includes(screen)
  )
    return undefined;
  return FACTORY_WEB_PAGES.find(page => page === screen);
}
