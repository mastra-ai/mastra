import {
  AgentIcon,
  Button,
  ButtonWithTooltip,
  DashboardCard,
  EmptyState,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  truncateString,
} from '@mastra/playground-ui';
import { Plus, Users } from 'lucide-react';
import { useProjects } from '@/domains/agent-studio/hooks/use-projects';
import { useCanCreateAgent } from '@/domains/agents/hooks/use-can-create-agent';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

export function AgentStudioProjects() {
  const { Link: FrameworkLink } = useLinkComponent();
  const { canCreateAgent } = useCanCreateAgent();
  const { data, isLoading, error } = useProjects();
  const { data: user } = useCurrentUser();

  const createPath = '/agent-studio/projects/create';

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Projects" icon={<Users />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Projects" icon={<Users />}>
        <PermissionDenied resource="agents" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Projects" icon={<Users />}>
        <ErrorState title="Failed to load projects" message={(error as Error).message} />
      </NoDataPageLayout>
    );
  }

  const allProjects = data?.projects ?? [];
  // Defense-in-depth: when the user is known, only show projects they authored.
  // Legacy projects without an authorId remain visible so existing data keeps working.
  const projects = user?.id ? allProjects.filter(p => !p.authorId || p.authorId === user.id) : allProjects;

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <Users /> Projects
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            {canCreateAgent && (
              <ButtonWithTooltip as={FrameworkLink} href={createPath} tooltipContent="Create a project">
                <Plus />
              </ButtonWithTooltip>
            )}
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {!isLoading && projects.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8">
          <EmptyState
            iconSlot={<Users />}
            titleSlot="No projects yet"
            descriptionSlot="Create a project to coordinate a team of agents around a shared goal."
            actionSlot={
              canCreateAgent ? (
                <Button as={FrameworkLink} href={createPath} variant="default">
                  <Plus className="h-4 w-4" /> New project
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
          data-testid="agent-studio-projects-grid"
        >
          {projects.map(project => {
            const chatUrl = `/agent-studio/projects/${project.id}/chat`;
            const teamSize = project.project?.invitedAgentIds?.length ?? 0;
            const taskCount = project.project?.tasks?.length ?? 0;
            return (
              <FrameworkLink key={project.id} href={chatUrl} data-testid={`project-card-${project.id}`}>
                <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-surface3 rounded-md p-2 text-icon4">
                      <AgentIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{project.name || project.id}</div>
                      <div className="text-xs text-icon3 mt-0.5">
                        {teamSize} agent{teamSize === 1 ? '' : 's'} · {taskCount} task{taskCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-icon3">{truncateString(project.description, 120)}</p>
                  )}
                </DashboardCard>
              </FrameworkLink>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}

export default AgentStudioProjects;
