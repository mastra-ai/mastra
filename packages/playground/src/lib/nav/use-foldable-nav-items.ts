import { useExpiringLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import { useEffect } from 'react';
import { z } from 'zod/v4';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { useWorkspaces } from '@/domains/workspace/hooks/use-workspace';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';
import type { NavItem } from '@/lib/nav/nav-items';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const recentSchema = z.literal(true);

export const navRecentStorageKey = (url: string) => `mastra:nav-recent:${url}`;

// One hook instance per foldable url so each visit expires on its own sliding 7-day window.
// `expiresAt` is recomputed every render so a click always stamps "now + 7 days".
function useRecentVisit(url: string) {
  return useExpiringLocalStorageState({
    key: navRecentStorageKey(url),
    expiresAt: Date.now() + SEVEN_DAYS_MS,
    schema: recentSchema,
  });
}

interface FoldableNavItems {
  /** True while the server-side "in use" signals (MCP servers, workspaces) are still resolving. */
  isResolving: boolean;
  /** Foldable items that earned a spot above the fold. */
  promoted: NavItem[];
  /** Foldable items that stay behind "More". */
  folded: NavItem[];
  markVisited: (url: string) => void;
}

export function useFoldableNavItems(items: NavItem[], pathname: string): FoldableNavItems {
  const mcpServers = useMCPServers();
  const workspaces = useWorkspaces();

  const recent = {
    '/processors': useRecentVisit('/processors'),
    '/mcps': useRecentVisit('/mcps'),
    '/tools': useRecentVisit('/tools'),
    '/workspaces': useRecentVisit('/workspaces'),
  };

  const isKnownUrl = (url: string): url is keyof typeof recent => url in recent;

  const markVisited = (url: string) => {
    if (isKnownUrl(url)) recent[url].setValue(true);
  };

  const hasMcpServers = (mcpServers.data?.length ?? 0) > 0;
  const hasWorkspaces = (workspaces.data?.workspaces.length ?? 0) > 0;
  const isResolving = mcpServers.isPending || (workspaces.isPending && workspaces.fetchStatus !== 'idle');

  const isPromoted = (item: NavItem) => {
    if (getIsLinkActive(item, pathname)) return true;
    if (isKnownUrl(item.url) && recent[item.url].value) return true;
    if (item.url === '/mcps') return hasMcpServers;
    if (item.url === '/workspaces') return hasWorkspaces;
    return false;
  };

  const activeUrl = items.find(item => getIsLinkActive(item, pathname))?.url;
  // Landing directly on a foldable route counts as a visit so it stays promoted after navigating away.
  useEffect(() => {
    if (activeUrl) markVisited(activeUrl);
    // markVisited is recreated each render; only the active route change matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

  return {
    isResolving,
    promoted: items.filter(isPromoted),
    folded: items.filter(item => !isPromoted(item)),
    markVisited,
  };
}
