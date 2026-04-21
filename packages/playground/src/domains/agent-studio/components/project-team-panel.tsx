import type { ProjectResponse } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { useStudioAgents } from '../hooks/use-studio-agents';
import { AgentAvatar } from './agent-avatar';
import { resolveAgentAvatar } from './avatar';
import { useLinkComponent } from '@/lib/framework';

export interface ProjectTeamPanelProps {
  project: ProjectResponse;
  canEdit: boolean;
}

/**
 * Lists the agents invited to a project. Lives at the top of the right-side
 * project panel, above the task list.
 */
export function ProjectTeamPanel({ project, canEdit }: ProjectTeamPanelProps) {
  const { Link } = useLinkComponent();
  const { allAgents } = useStudioAgents({ scope: 'all' });

  const invitedIds = useMemo(() => project.project?.invitedAgentIds ?? [], [project.project?.invitedAgentIds]);

  const invitedAgents = useMemo(() => {
    const byId = new Map(allAgents.map(a => [a.id, a] as const));
    return invitedIds.map(id => ({ id, agent: byId.get(id) }));
  }, [allAgents, invitedIds]);

  return (
    <section className="flex flex-col gap-2" data-testid="project-team-panel">
      <div className="flex items-center justify-between">
        <Txt variant="ui-md">Team</Txt>
        <Txt variant="ui-sm" className="text-icon3">
          {invitedIds.length}
        </Txt>
      </div>

      {invitedIds.length === 0 ? (
        <Txt variant="ui-sm" className="text-icon3 py-2">
          No teammates yet.
          {canEdit ? (
            <>
              {' '}
              <Link
                href={`/agent-studio/projects/${project.id}/edit`}
                className="text-icon4 underline hover:text-icon5"
              >
                Invite agents
              </Link>
              .
            </>
          ) : null}
        </Txt>
      ) : (
        <ul className="flex flex-col gap-1">
          {invitedAgents.map(({ id, agent }) => {
            const name = agent?.name ?? id;
            const avatarUrl = agent ? resolveAgentAvatar(agent) : undefined;
            const description = agent?.description;
            const chatUrl = `/agent-studio/agents/${id}/chat`;
            return (
              <li key={id} data-testid={`project-team-member-${id}`}>
                <Link
                  href={chatUrl}
                  className="flex items-center gap-2 bg-surface3 hover:border-border2 border border-transparent rounded-md px-2 py-1.5"
                >
                  <AgentAvatar name={name} avatarUrl={avatarUrl} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{name}</div>
                    {description && <div className="text-xs text-icon3 truncate">{description}</div>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && invitedIds.length > 0 && (
        <Link
          href={`/agent-studio/projects/${project.id}/edit`}
          className="text-xs text-icon3 hover:text-icon5 underline self-start"
          data-testid="project-team-manage-link"
        >
          Manage team
        </Link>
      )}
    </section>
  );
}
