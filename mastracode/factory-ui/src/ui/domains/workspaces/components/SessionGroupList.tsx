import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDashed, GitPullRequest, MessageSquare, SquareKanban, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';

import { collapsedRowsKeepingActive, nestCardSessions } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';

const GROUP_ICONS: Record<SessionGroupIcon, ReactNode> = {
  board: <SquareKanban />,
  review: <GitPullRequest />,
  user: <MessageSquare />,
  slack: <MessageSquare />,
  status: <CircleDashed />,
  owner: <UserRound />,
  all: null,
};

export function SessionGroupList({
  group,
  showHeader,
  renderRow,
}: {
  group: SessionGroup;
  showHeader: boolean;
  renderRow: (row: SessionListRow) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsedRows = collapsedRowsKeepingActive(group.rows);

  return (
    <section className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
      {showHeader && (
        <Sidebar.NavHeader className="mt-0" icon={GROUP_ICONS[group.icon]}>
          {group.label}
        </Sidebar.NavHeader>
      )}
      <Sidebar.NavList>
        {nestCardSessions(expanded ? group.rows : collapsedRows).map(entry =>
          entry.kind === 'card' ? (
            <li key={`card:${entry.itemId}`} className="flex min-w-0 flex-col gap-0.5">
              <Txt as="span" variant="caption" tone="muted" className="truncate px-2 pt-1">
                {entry.title}
              </Txt>
              <Sidebar.NavList className="pl-3">
                {entry.rows.map(row => (
                  <Fragment key={row.session.sessionId}>{renderRow(row)}</Fragment>
                ))}
              </Sidebar.NavList>
            </li>
          ) : (
            <Fragment key={entry.row.session.sessionId}>{renderRow(entry.row)}</Fragment>
          ),
        )}
      </Sidebar.NavList>
      <Sidebar.NavShowMore
        foldedCount={group.rows.length - collapsedRows.length}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    </section>
  );
}
