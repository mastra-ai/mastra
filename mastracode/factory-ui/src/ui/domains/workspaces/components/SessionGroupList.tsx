import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { CircleDashed, GitPullRequest, MessageSquare, SquareKanban, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';

import { collapsedRowsKeepingActive } from '../services/sessionGroups';
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
  isOpen,
}: {
  group: SessionGroup;
  showHeader: boolean;
  renderRow: (row: SessionListRow) => ReactNode;
  /** Which row holds the open session, so the collapsed list keeps it. Defaults to the active row. */
  isOpen?: (row: SessionListRow) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsedRows = collapsedRowsKeepingActive(group.rows, isOpen);

  return (
    <section className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
      {showHeader && (
        <Sidebar.NavHeader className="mt-0" icon={GROUP_ICONS[group.icon]}>
          {group.label}
        </Sidebar.NavHeader>
      )}
      <Sidebar.NavList>
        {(expanded ? group.rows : collapsedRows).map(row => (
          <Fragment key={row.session.sessionId}>{renderRow(row)}</Fragment>
        ))}
      </Sidebar.NavList>
      <Sidebar.NavShowMore
        foldedCount={group.rows.length - collapsedRows.length}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    </section>
  );
}
