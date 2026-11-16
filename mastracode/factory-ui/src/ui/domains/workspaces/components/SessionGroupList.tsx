import { SESSION_ROW_WINDOW, SESSION_ROW_WINDOW_MAX } from '@mastra/factory/session/session-row-query';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';

import { SESSION_GROUP_INCREMENT } from '../services/sessionGroups';
import type { SessionGroup, SessionGroupIcon } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';
import { IconChatBubble7 } from '@mastra/playground-ui/icons/central/IconChatBubble7';

type ToggleName = 'more' | 'less';

const GROUP_ICONS: Record<SessionGroupIcon, ReactNode> = {
  board: <IconKanbanView />,
  review: <IconPullRequest />,
  user: <IconChatBubble7 />,
  slack: <IconChatBubble7 />,
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
  const [handOff, setHandOff] = useState<{ to: ToggleName; fromRowCount: number }>();
  const openBelowFold = group.openIndex !== undefined && group.openIndex >= SESSION_ROW_WINDOW;
  const remainingCount = Math.min(group.total, SESSION_ROW_WINDOW_MAX) - group.rows.length;
  const collapsibleCount = group.rows.length - Math.min(group.total, SESSION_ROW_WINDOW + Number(openBelowFold));

  // The pressed toggle unmounts once the answer leaves it nothing to count, so hand focus to the one that remains.
  const focusOnAnswer = (name: ToggleName) => (toggle: HTMLButtonElement | null) => {
    if (!toggle || handOff?.to !== name || handOff.fromRowCount === group.rows.length) return;
    toggle.focus();
    setHandOff(undefined);
  };

  const showMore = () => {
    if (remainingCount <= SESSION_GROUP_INCREMENT) setHandOff({ to: 'less', fromRowCount: group.rows.length });
    onShowMore();
  };

  const showLess = () => {
    setHandOff({ to: 'more', fromRowCount: group.rows.length });
    onShowLess();
  };

  return (
    <section className="flex flex-col gap-1" aria-label={`${group.label} sessions`}>
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
          ref={focusOnAnswer('more')}
          foldedCount={Math.min(remainingCount, SESSION_GROUP_INCREMENT)}
          expanded={false}
          onExpandedChange={showMore}
          aria-expanded={undefined}
        />
        <Sidebar.NavShowMore
          ref={focusOnAnswer('less')}
          foldedCount={collapsibleCount}
          expanded
          onExpandedChange={showLess}
          aria-expanded={undefined}
        />
      </div>
    </section>
  );
}
