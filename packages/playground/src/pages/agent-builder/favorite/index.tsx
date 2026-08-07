import type { ListStoredAgentsParams, StoredSkillResponse } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { SparklesIcon, StarIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-list/agent-builder-list';
import {
  SkillBuilderList,
  SkillBuilderListSkeleton,
} from '@/domains/agent-builder/components/skill-list/skill-builder-list';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

type Tab = 'agents' | 'skills';

export default function AgentBuilderFavoritePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('agents');
  const features = useBuilderAgentFeatures();
  const { data: currentUser } = useCurrentUser();

  const handleSkillClick = (skill: StoredSkillResponse) => {
    const isOwner = !skill.authorId || currentUser?.id === skill.authorId;
    const destination = isOwner ? 'edit' : 'view';
    void navigate(`/agent-builder/skills/${skill.id}/${destination}`, { viewTransition: true });
  };

  const agentListParams = useMemo<ListStoredAgentsParams>(
    () => ({
      favoritedOnly: true,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    }),
    [],
  );

  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = useStoredAgents(agentListParams);
  const {
    data: skillsData,
    isLoading: skillsLoading,
    error: skillsError,
  } = useStoredSkills({ enabled: tab === 'skills' && features.skills });

  const agents = agentsData?.agents ?? [];
  const skills = skillsData?.skills ?? [];

  const renderError = (error: Error, resource: string) => {
    if (is401UnauthorizedError(error)) {
      return (
        <div className="flex items-center justify-center pt-10">
          <SessionExpired />
        </div>
      );
    }
    if (is403ForbiddenError(error)) {
      return (
        <div className="flex items-center justify-center pt-10">
          <PermissionDenied resource={resource} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center pt-10">
        <ErrorState title={`Failed to load favorite ${resource}`} message={error.message} />
      </div>
    );
  };

  const body = (() => {
    if (tab === 'agents') {
      if (agentsLoading) return <AgentBuilderListSkeleton rowTestId="favorite-skeleton-row" />;
      if (agentsError) return renderError(agentsError, 'agents');
      if (agents.length === 0) {
        return (
          <div className="flex items-center justify-center pt-16">
            <EmptyState
              iconSlot={<StarIcon className="text-neutral3 h-8 w-8" />}
              titleSlot="No favorite agents yet"
              descriptionSlot="Star agents to keep them here for quick access."
            />
          </div>
        );
      }
      return <AgentBuilderList agents={agents} search={search} rowTestId="favorite-agent-row" />;
    }

    // Skills tab
    if (skillsLoading) return <SkillBuilderListSkeleton />;
    if (skillsError) return renderError(skillsError, 'skills');
    if (skills.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<SparklesIcon className="text-neutral3 h-8 w-8" />}
            titleSlot="No favorite skills yet"
            descriptionSlot="Star skills to keep them here for quick access."
          />
        </div>
      );
    }
    return <SkillBuilderList skills={skills} search={search} onSkillClick={handleSkillClick} />;
  })();

  return (
    <>
      <PageLayout className="px-4 md:px-10">
        <PageLayout.TopArea>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <PageHeader>
              <PageHeader.Title>
                <StarIcon /> Favorites
              </PageHeader.Title>
              <PageHeader.Description>
                {tab === 'agents'
                  ? "Agents you've starred in Agent Builder."
                  : "Skills you've starred in Agent Builder."}
              </PageHeader.Description>
            </PageHeader>
          </div>
          <div className="flex items-center gap-4">
            {features.skills && (
              <div className="border-border1 flex overflow-hidden rounded-lg border">
                <button
                  onClick={() => setTab('agents')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === 'agents' ? 'bg-surface4 text-neutral6' : 'bg-surface2 text-neutral3 hover:text-neutral5'
                  }`}
                >
                  Agents
                </button>
                <button
                  onClick={() => setTab('skills')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === 'skills' ? 'bg-surface4 text-neutral6' : 'bg-surface2 text-neutral3 hover:text-neutral5'
                  }`}
                >
                  Skills
                </button>
              </div>
            )}
            <div className="max-w-120 flex-1">
              <ListSearch onSearch={setSearch} label="Filter favorites" placeholder="Filter by name or description" />
            </div>
          </div>
        </PageLayout.TopArea>

        {body}
      </PageLayout>
    </>
  );
}
