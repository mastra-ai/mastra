import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { useBoardQuery } from '../../hooks/useBoardEditor';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { boardConfigPath } from '../domains/boardConfig/boardConfigPaths';
import { FactorySkillsSection } from '../domains/boardConfig/components/FactorySkillsSection';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const COLUMN = 'mx-auto w-full max-w-2xl';

/**
 * The factory's skills that no board phase runs, opened from board settings. The board in the URL only keeps
 * its settings in the sidebar; the skills belong to the whole factory.
 */
export function FactorySkillsPage() {
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
            Skills
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
            <PageHeader.Title>Skills</PageHeader.Title>
            <PageHeader.Description>
              Agents load these when they need them. Skills a phase runs are on that phase's page.
            </PageHeader.Description>
          </PageHeader>
        </div>
      }
      {...slots}
    >
      <div className={COLUMN}>
        <FactorySkillsSection factoryId={factory.id} />
      </div>
    </PageLayout>
  );
}
