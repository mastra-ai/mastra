import { Badge } from '@mastra/playground-ui/components/Badge';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Timeline } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useParams } from 'react-router';

import { useFactoryAttentionSummary } from '../../../../hooks/useFactoryAttention';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useOverlays } from '../../../lib/overlays';
import { attentionCounts, INTERRUPTING_KINDS, latestUnreadOrNewestIn, NEEDS_YOU_KINDS } from '../services/attention';
import type { FactoryAttentionKindSummaries } from '../services/attention';
import { playAttentionSoundOnce } from '../services/attentionSound';

function linkLabel(unread: number): string {
  return unread > 0 ? `Activity, ${unread} unread` : 'Activity';
}

/** Chimes once per newly arrived unread failure, finding, waiting agent or mention; approvals stay silent. */
function useAttentionChime(factoryId: string | undefined, kinds: FactoryAttentionKindSummaries | undefined) {
  const auth = useFactoryAuth();
  const soundScope = auth.data?.user?.userId ?? 'local';
  const baseline = useRef<{ scope: string; key: string | null; occurredAt: number; unread: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!kinds) return;
    const scope = `${soundScope}:${factoryId ?? 'none'}`;
    const latest = latestUnreadOrNewestIn(kinds, INTERRUPTING_KINDS);
    const key = latest?.key ?? null;
    const occurredAt = latest ? Date.parse(latest.at) : 0;
    const unread = attentionCounts(kinds, INTERRUPTING_KINDS).unread;
    const previous = baseline.current;
    baseline.current = { scope, key, occurredAt, unread };
    if (!previous || previous.scope !== scope || !latest?.unread) return;
    if (previous.key === key) return;
    if (occurredAt < previous.occurredAt || (occurredAt === previous.occurredAt && unread <= previous.unread)) return;
    void playAttentionSoundOnce(scope, latest.key);
  }, [kinds, factoryId, soundScope]);
}

export function SidebarActivityLink() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const overlays = useOverlays();
  const { pathname } = useLocation();
  const kinds = useFactoryAttentionSummary(factoryId).data;
  const unread = kinds ? attentionCounts(kinds, INTERRUPTING_KINDS).unread : 0;
  const open = kinds ? attentionCounts(kinds, NEEDS_YOU_KINDS).open : 0;
  useAttentionChime(factoryId, kinds);

  if (!factoryId) return null;

  const to = `/factories/${factoryId}/activity`;

  return (
    <Sidebar.NavLink
      link={{ name: 'Activity', url: to }}
      isActive={pathname === to}
      render={
        <NavLink to={to} aria-label={linkLabel(unread)} onClick={() => overlays.close('sidebar')}>
          <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
            <Timeline size={16} />
            {open > 0 ? (
              <span className="bg-warning-indicator absolute -top-0.5 -right-0.5 size-1.5 rounded-full" />
            ) : null}
          </span>
          <Sidebar.NavLabel className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">Activity</span>
            {unread > 0 ? (
              <Badge variant="orange" size="sm">
                {unread}
              </Badge>
            ) : null}
          </Sidebar.NavLabel>
        </NavLink>
      }
    />
  );
}
