import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { CircleDashed, GitPullRequest, MessageSquare, SquareKanban, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, startTransition, useLayoutEffect, useRef, useState } from 'react';

import { collapsedRowsKeepingActive } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';

const GROUP_ROW_INCREMENT = 20;

type ToggleName = 'more' | 'less';

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
  const sectionRef = useRef<HTMLElement>(null);
  // The button that was pressed unmounts once its count reaches zero; hand focus to the one left.
  const focusAfterChange = useRef<ToggleName | null>(null);

  useLayoutEffect(() => {
    const target = focusAfterChange.current;
    focusAfterChange.current = null;
    if (target)
      sectionRef.current?.querySelector<HTMLButtonElement>(`[data-session-group-toggle="${target}"]`)?.focus();
  }, [additionalRowCount]);

  const showMore = () => {
    const nextCount = additionalRowCount + GROUP_ROW_INCREMENT;
    if (collapsedRowsKeepingActive(group.rows, nextCount).length === group.rows.length)
      focusAfterChange.current = 'less';
    startTransition(() => setAdditionalRowCount(nextCount));
  };

  const showLess = () => {
    focusAfterChange.current = 'more';
    setAdditionalRowCount(0);
  };

  return (
    <section ref={sectionRef} className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
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
          onExpandedChange={showMore}
          aria-expanded={undefined}
          data-session-group-toggle="more"
        />
        <Sidebar.NavShowMore
          foldedCount={visibleRows.length - collapsedRows.length}
          expanded
          onExpandedChange={showLess}
          aria-expanded={undefined}
          data-session-group-toggle="less"
        />
      </div>
    </section>
  );
}
