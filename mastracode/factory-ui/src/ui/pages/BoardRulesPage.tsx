import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { useBoardQuery } from '../../hooks/useBoardEditor';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { boardConfigPath } from '../domains/boardConfig/boardConfigPaths';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { BoardRules } from '../domains/boardRules/components/BoardRules';
import { IntakeTesterDialog } from '../domains/intake/IntakeTesterDialog';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const COLUMN = 'mx-auto w-full max-w-3xl';

/** Every rule of a board, one lane per trigger: what it takes when an item arrives and where its cards move. */
export function BoardRulesPage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';
  const { isMobile, desktopState } = useSidebar();
  const sidebarHidden = isMobile || desktopState === 'collapsed';
  const board = useBoardQuery(factory.id, boardId).data?.board;

  const slots = useSidebarHeaderSlots({
    breadcrumbs:
      sidebarHidden && board ? (
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as={Link} to={boardConfigPath(factory.id, boardId)}>
            {board.name}
          </Crumb>
          <Crumb as="span" isCurrent>
            Rules
          </Crumb>
        </Breadcrumb>
      ) : undefined,
  });

  return (
    <PageLayout
      variant="narrow"
      header={
        <div className={cn(COLUMN, 'pb-8')}>
          <PageHeader>
            <PageHeader.Title>Rules</PageHeader.Title>
            <PageHeader.Description>
              What happens to issues and pull requests on this board. In each lane the first matching rule wins.
            </PageHeader.Description>
          </PageHeader>
          <div className="mt-3">
            <IntakeTesterDialog factoryProjectId={factory.id} label="Test an issue or pull request" />
          </div>
        </div>
      }
      {...slots}
    >
      <div className={COLUMN}>
        <BoardRules factoryId={factory.id} boardId={boardId} />
      </div>
    </PageLayout>
  );
}
