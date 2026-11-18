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
import { SETTINGS_COLUMN } from '../domains/boardConfig/settingsColumn';
import { IntakeOrderSection } from '../domains/settings/components/IntakeOrderSection';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

/** Which board takes new work: the order boards are offered a new issue or pull request, and the ones no board took. */
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
        <div className={cn(SETTINGS_COLUMN, 'pb-8')}>
          <PageHeader>
            <PageHeader.Title>Routing</PageHeader.Title>
            <PageHeader.Description>
              <span>
                The order boards are offered new issues and pull requests. What comes in is chosen in{' '}
                <Link to={settingsSectionPath(factory.id, 'intake')} className="underline">
                  Settings → Work Intake
                </Link>
                .
              </span>
            </PageHeader.Description>
          </PageHeader>
        </div>
      }
      {...slots}
    >
      <div className={cn(SETTINGS_COLUMN, 'flex flex-col gap-8')}>
        <IntakeOrderSection factoryId={factory.id} />
      </div>
    </PageLayout>
  );
}
