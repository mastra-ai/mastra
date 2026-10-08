import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { CalendarClock, ChevronLeft, List } from 'lucide-react';
import { useLocation, useParams } from 'react-router';
import { RecentWorkflows } from './recent-workflows';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { NavigationQueryState } from '@/components/ui/navigation-query-state';
import { SidebarSlot } from '@/components/ui/sidebar-slot';

export function WorkflowNavigation() {
  const { pathname } = useLocation();
  const { workflowId } = useParams();
  const { Link } = useLinkComponent();
  const { data: workflows = {}, isLoading, error } = useWorkflows();
  return (
    <ContextualSidebarLayout
      label="Workflow navigation"
      header={
        <div className="shrink-0">
          <ContextualSidebarHeader>
            {workflowId ? (
              <Button variant="ghost" size="sm" icon={<ChevronLeft />} render={<Link href="/workflows" />}>
                All workflows
              </Button>
            ) : (
              <Txt variant="subheading" className="px-3">
                Workflows
              </Txt>
            )}
          </ContextualSidebarHeader>
        </div>
      }
    >
      <ScrollArea
        maxHeight={workflowId ? 'min(30vh, 16rem)' : undefined}
        className={workflowId ? 'shrink-0 border-b border-border' : 'min-h-0 flex-1'}
        mask={false}
      >
        <ContextualSidebarSection>
          {workflowId ? (
            <NavigationQueryState
              isLoading={isLoading}
              hasError={Boolean(error)}
              isEmpty={Object.keys(workflows).length === 0}
            >
              <RecentWorkflows key={workflowId} workflowId={workflowId} workflows={workflows} />
            </NavigationQueryState>
          ) : (
            <Sidebar.Nav aria-label="Workflow views">
              <Sidebar.NavList>
                <Sidebar.NavLink
                  state="default"
                  link={{ name: 'All workflows', url: '/workflows', icon: <List /> }}
                  isActive={pathname === '/workflows'}
                />
                <Sidebar.NavLink
                  state="default"
                  link={{ name: 'Schedules', url: '/workflows/schedules', icon: <CalendarClock /> }}
                  isActive={pathname.startsWith('/workflows/schedules')}
                />
              </Sidebar.NavList>
              <Sidebar.NavSection>
                <Sidebar.NavHeader state="default">Your workflows</Sidebar.NavHeader>
                <NavigationQueryState
                  isLoading={isLoading}
                  hasError={Boolean(error)}
                  isEmpty={Object.keys(workflows).length === 0}
                >
                  <Sidebar.NavList>
                    {Object.entries(workflows).map(([id, workflow]) => (
                      <Sidebar.NavLink
                        key={id}
                        state="default"
                        link={{
                          name: workflow.name ?? id,
                          url: `/workflows/${encodeURIComponent(id)}/graph`,
                          icon: <WorkflowIcon />,
                        }}
                      />
                    ))}
                  </Sidebar.NavList>
                </NavigationQueryState>
              </Sidebar.NavSection>
            </Sidebar.Nav>
          )}
        </ContextualSidebarSection>
      </ScrollArea>
      {workflowId && <SidebarSlot />}
    </ContextualSidebarLayout>
  );
}
