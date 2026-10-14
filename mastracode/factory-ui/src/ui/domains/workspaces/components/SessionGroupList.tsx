import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitPullRequest, MessageSquare, SquareKanban } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import { getSessionOwnerDetails } from '../services/sessionPresentation';
import type { SessionViewerProfile } from '../services/sessionPresentation';
import type { SessionListRow } from '../services/sessionRows';
import { sessionRowStatus } from '../services/sessionStatus';
import { SessionNavRow } from './SessionNavRow';

export const COLLAPSED_ROW_COUNT = 5;

const GROUP_ICONS: Record<SessionGroupIcon, ReactNode> = {
  board: <SquareKanban />,
  review: <GitPullRequest />,
  user: <MessageSquare />,
};

export function collapsedRowsKeepingActive(rows: readonly SessionListRow[]): SessionListRow[] {
  const visible = rows.slice(0, COLLAPSED_ROW_COUNT);
  const open = rows.find(row => row.active);
  if (open && !visible.includes(open)) visible.push(open);
  return visible;
}

export function SessionGroupList({
  group,
  showHeader,
  pending,
  mergedByPath,
  viewerUserId,
  viewerProfile,
  regenerating,
  onOpen,
  onPinChange,
  onDelete,
  onRegenerateTitle,
}: {
  group: SessionGroup;
  showHeader: boolean;
  pending: boolean;
  mergedByPath: Record<string, boolean>;
  viewerUserId?: string;
  viewerProfile?: SessionViewerProfile;
  regenerating: ReadonlySet<string>;
  onOpen: (row: SessionListRow) => void;
  onPinChange: (sessionId: string, pinned: boolean) => void;
  onDelete: (row: SessionListRow) => void;
  onRegenerateTitle: (row: SessionListRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = collapsedRowsKeepingActive(group.rows);
  const visibleRows = expanded ? group.rows : collapsed;
  const hiddenCount = group.rows.length - collapsed.length;

  return (
    <section className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
      {showHeader && <Sidebar.NavHeader icon={GROUP_ICONS[group.icon]}>{group.label}</Sidebar.NavHeader>}
      <Sidebar.NavList>
        {visibleRows.map(row => {
          const sessionId = row.session.sessionId;
          const factorySession = row.origin === 'factory';
          const ownedByViewer = !viewerUserId || row.session.userId === viewerUserId;
          return (
            <SessionNavRow
              key={sessionId}
              name={row.name}
              url={row.url}
              active={row.active}
              disabled={pending}
              merged={factorySession ? (mergedByPath[sessionId] ?? row.knownMerged) : undefined}
              changeRequestProvider={factorySession ? row.provider : undefined}
              status={sessionRowStatus(row)}
              pinned={row.pinned}
              preview={{
                kind: row.kind,
                owner: getSessionOwnerDetails(row.session, viewerProfile),
                itemLabel: row.itemLabel,
                itemTitle: row.itemTitle,
                branch: row.session.branch,
                baseBranch: row.session.baseBranch,
                updatedAt: row.updatedAt,
              }}
              onSelect={() => onOpen(row)}
              onPinChange={pinned => onPinChange(sessionId, pinned)}
              onDelete={ownedByViewer ? () => onDelete(row) : undefined}
              onRegenerateTitle={!factorySession && ownedByViewer ? () => onRegenerateTitle(row) : undefined}
              regeneratingTitle={regenerating.has(sessionId)}
            />
          );
        })}
      </Sidebar.NavList>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className={cn('text-muted-foreground', 'hover:text-foreground pl-3 text-left')}
        >
          <Txt as="span" variant="caption" className="block">
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </Txt>
        </button>
      )}
    </section>
  );
}
