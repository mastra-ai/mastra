import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { CircleDashed, GitPullRequest, MessageSquare, SquareKanban, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, startTransition, useState } from 'react';

import { collapsedRowsKeepingActive } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';

const GROUP_ROW_INCREMENT = 20;

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
  const [additionalRowCount, setAdditionalRowCount] = useState(0);
  const collapsedRows = collapsedRowsKeepingActive(group.rows);
  const visibleRows = collapsedRowsKeepingActive(group.rows, additionalRowCount);
  const remainingCount = group.rows.length - visibleRows.length;

  return (
    <section className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
      {showHeader && (
        <Sidebar.NavHeader className="mt-0" icon={GROUP_ICONS[group.icon]}>
          {group.label}
        </Sidebar.NavHeader>
      )}
      <Sidebar.NavList>
        {visibleRows.map(row => (
          <Fragment key={row.session.sessionId}>{renderRow(row)}</Fragment>
        ))}
      </Sidebar.NavList>
      <div className="flex items-center gap-3">
        <Sidebar.NavShowMore
          foldedCount={Math.min(remainingCount, GROUP_ROW_INCREMENT)}
          expanded={false}
          onExpandedChange={() => startTransition(() => setAdditionalRowCount(count => count + GROUP_ROW_INCREMENT))}
        />
        <Sidebar.NavShowMore
          foldedCount={visibleRows.length - collapsedRows.length}
          expanded
          onExpandedChange={() => setAdditionalRowCount(0)}
        />
      </div>
    </section>
  );
}
