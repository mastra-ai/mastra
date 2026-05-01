import type { ListStoredAgentsParams, ListStoredSkillsParams, StoredSkillResponse } from '@mastra/client-js';
import {
  EmptyState,
  EntityListPageLayout,
  ErrorState,
  ListSearch,
  PageHeader,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { LibraryIcon, SparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import {
  SkillBuilderList,
  SkillBuilderListSkeleton,
} from '@/domains/agent-builder/components/skill-builder-list/skill-builder-list';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { SkillEditDialog } from '@/domains/agents/components/agent-cms-pages/skill-edit-dialog';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

type Tab = 'agents' | 'skills';

export default function AgentBuilderLibraryPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('agents');
  const [selectedSkill, setSelectedSkill] = useState<StoredSkillResponse | null>(null);
  const features = useBuilderAgentFeatures();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.includes('*') ?? false;

  const agentListParams = useMemo<ListStoredAgentsParams>(() => ({ visibility: 'public' }), []);
  const skillListParams = useMemo<ListStoredSkillsParams>(() => ({ visibility: 'public' }), []);

  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = useStoredAgents(agentListParams);
  const {
    data: skillsData,
    isLoading: skillsLoading,
    error: skillsError,
  } = useStoredSkills(skillListParams, { enabled: tab === 'skills' && features.skills });

  const agents = agentsData?.agents ?? [];
  const skills = skillsData?.skills ?? [];

  const renderError = (error: Error) => {
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
          <PermissionDenied resource={tab} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center pt-10">
        <ErrorState title="Failed to load the library" message={error.message} />
      </div>
    );
  };

  const body = (() => {
    if (tab === 'agents') {
      if (agentsLoading) return <AgentBuilderListSkeleton rowTestId="library-skeleton-row" />;
      if (agentsError) return renderError(agentsError);
      if (agents.length === 0) {
        return (
          <div className="flex items-center justify-center pt-16">
            <EmptyState
              iconSlot={<LibraryIcon className="h-8 w-8 text-neutral3" />}
              titleSlot="No public agents yet"
              descriptionSlot="Mark an agent as Public to share it with the team library."
            />
          </div>
        );
      }
      return <AgentBuilderList agents={agents} search={search} rowTestId="library-agent-row" />;
    }

    // Skills tab
    if (skillsLoading) return <SkillBuilderListSkeleton />;
    if (skillsError) return renderError(skillsError);
    if (skills.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<SparklesIcon className="h-8 w-8 text-neutral3" />}
            titleSlot="No public skills yet"
            descriptionSlot="Mark a skill as Public to share it with the team library."
          />
        </div>
      );
    }
    return <SkillBuilderList skills={skills} search={search} onSkillClick={setSelectedSkill} />;
  })();

  return (
    <>
      <EntityListPageLayout className="px-4 md:px-10">
        <EntityListPageLayout.Top>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <PageHeader>
              <PageHeader.Title>
                <LibraryIcon /> Library
              </PageHeader.Title>
              <PageHeader.Description>
                {tab === 'agents' ? 'Agents shared with the team library.' : 'Skills shared with the team library.'}
              </PageHeader.Description>
            </PageHeader>
          </div>
          <div className="flex items-center gap-4">
            {features.skills && (
              <div className="flex rounded-lg border border-border1 overflow-hidden">
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
            <div className="flex-1 max-w-120">
              <ListSearch onSearch={setSearch} label="Filter library" placeholder="Filter by name or description" />
            </div>
          </div>
        </EntityListPageLayout.Top>

        {body}
      </EntityListPageLayout>

      {selectedSkill && (
        <SkillEditDialog
          isOpen={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
          skill={selectedSkill}
          currentUserId={currentUser?.id}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
