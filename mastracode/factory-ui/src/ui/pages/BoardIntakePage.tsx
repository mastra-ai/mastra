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
import { IntakeOrderSection } from '../domains/settings/components/IntakeOrderSection';
import { NotRoutedSection } from '../domains/settings/components/NotRoutedSection';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const COLUMN = 'mx-auto w-full max-w-2xl';

/** Which board takes new work: the order boards are offered a new item, and the items no board took. */
export function BoardIntakePage() {
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
            Routing
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
            <PageHeader.Title>Routing</PageHeader.Title>
            <PageHeader.Description>
              The order boards are offered new issues and pull requests. What comes in is chosen in{' '}
              <Link to={settingsSectionPath(factory.id, 'intake')} className="underline">
                Settings → Work Intake
              </Link>
              .
            </PageHeader.Description>
          </PageHeader>
        </div>
      }
      {...slots}
    >
      <div className={cn(COLUMN, 'flex flex-col gap-8')}>
        <IntakeOrderSection factoryId={factory.id} />
        <NotRoutedSection factoryId={factory.id} />
      </div>
    </PageLayout>
  );
}
