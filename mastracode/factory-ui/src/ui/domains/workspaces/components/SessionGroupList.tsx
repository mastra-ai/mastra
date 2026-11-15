import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { ReactNode } from 'react';
import { Fragment, startTransition, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { collapsedRowsKeepingActive } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';
import { IconBubble2 } from '@mastra/playground-ui/icons/central/IconBubble2';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';

const GROUP_ROW_INCREMENT = 20;

type ToggleName = 'more' | 'less';

const GROUP_ICONS: Record<SessionGroupIcon, ReactNode> = {
  board: <IconKanbanView />,
  review: <IconPullRequest />,
  user: <IconBubble2 />,
  slack: <IconBubble2 />,
  status: <IconCircleDashed />,
  owner: <IconUser />,
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

  // The pressed toggle unmounts once its count reaches zero, so hand focus to the one that remains.
  const focusToggle = (name: ToggleName) =>
    sectionRef.current?.querySelector<HTMLButtonElement>(`[data-session-group-toggle="${name}"]`)?.focus();

  const showMore = () => {
    const nextCount = additionalRowCount + GROUP_ROW_INCREMENT;
    if (collapsedRowsKeepingActive(group.rows, nextCount).length < group.rows.length) {
      startTransition(() => setAdditionalRowCount(nextCount));
      return;
    }
    flushSync(() => setAdditionalRowCount(nextCount));
    focusToggle('less');
  };

  const showLess = () => {
    flushSync(() => setAdditionalRowCount(0));
    focusToggle('more');
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
