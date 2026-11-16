import { SESSION_ROW_WINDOW } from '@mastra/factory/session/session-row-limits';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useRef } from 'react';

import { SESSION_GROUP_INCREMENT } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';
import { IconBubbleWide } from '@mastra/playground-ui/icons/central/IconBubbleWide';

type ToggleName = 'more' | 'less';

const GROUP_ICONS: Record<SessionGroupIcon, ReactNode> = {
  board: <IconKanbanView />,
  review: <IconPullRequest />,
  user: <IconBubbleWide />,
  slack: <IconBubbleWide />,
  status: <IconCircleDashed />,
  owner: <IconUser />,
  all: null,
};

export function SessionGroupList({
  group,
  showHeader,
  renderRow,
  onShowMore,
  onShowLess,
}: {
  group: SessionGroup;
  showHeader: boolean;
  renderRow: (row: SessionListRow) => ReactNode;
  onShowMore: () => void;
  onShowLess: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const focusOnAnswer = useRef<ToggleName | undefined>(undefined);
  const openBelowFold = group.openIndex !== undefined && group.openIndex >= SESSION_ROW_WINDOW;
  const remainingCount = group.total - group.rows.length;
  const collapsibleCount = group.rows.length - Math.min(group.total, SESSION_ROW_WINDOW + Number(openBelowFold));

  // The pressed toggle unmounts once the answer leaves it nothing to count, so hand focus to the one that remains.
  useEffect(() => {
    const name = focusOnAnswer.current;
    if (!name) return;
    focusOnAnswer.current = undefined;
    sectionRef.current?.querySelector<HTMLButtonElement>(`[data-session-group-toggle="${name}"]`)?.focus();
  }, [group.rows.length]);

  const showMore = () => {
    if (remainingCount <= SESSION_GROUP_INCREMENT) focusOnAnswer.current = 'less';
    onShowMore();
  };

  const showLess = () => {
    focusOnAnswer.current = 'more';
    onShowLess();
  };

  return (
    <section ref={sectionRef} className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
      {showHeader && (
        <Sidebar.NavHeader className="mt-0" icon={GROUP_ICONS[group.icon]}>
          {group.label}
        </Sidebar.NavHeader>
      )}
      <Sidebar.NavList>
        {group.rows.map(row => (
          <Fragment key={row.session.sessionId}>{renderRow(row)}</Fragment>
        ))}
      </Sidebar.NavList>
      <div className="flex items-center gap-3">
        <Sidebar.NavShowMore
          foldedCount={Math.min(remainingCount, SESSION_GROUP_INCREMENT)}
          expanded={false}
          onExpandedChange={showMore}
          aria-expanded={undefined}
          data-session-group-toggle="more"
        />
        <Sidebar.NavShowMore
          foldedCount={collapsibleCount}
          expanded
          onExpandedChange={showLess}
          aria-expanded={undefined}
          data-session-group-toggle="less"
        />
      </div>
    </section>
  );
}
