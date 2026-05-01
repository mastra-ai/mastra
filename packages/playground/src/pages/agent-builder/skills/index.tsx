import type { ListStoredSkillsParams, StoredSkillResponse } from '@mastra/client-js';
import {
  Button,
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
import { PlusIcon, SparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  SkillBuilderList,
  SkillBuilderListSkeleton,
} from '@/domains/agent-builder/components/skill-builder-list/skill-builder-list';
import { SkillEditDialog } from '@/domains/agents/components/agent-cms-pages/skill-edit-dialog';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

type Scope = 'mine' | 'all';

export default function AgentBuilderSkillsPage() {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.includes('*') ?? false;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<StoredSkillResponse | null>(null);
  const [scope, setScope] = useState<Scope>('mine');

  const listParams = useMemo<ListStoredSkillsParams>(() => {
    const params: ListStoredSkillsParams = {};
    if (scope === 'mine' && currentUser?.id) {
      params.authorId = currentUser.id;
    }
    return params;
  }, [currentUser?.id, scope]);

  const { data, isLoading, error } = useStoredSkills(listParams, { enabled: !isCurrentUserLoading });
  const [search, setSearch] = useState('');

  const skills = data?.skills ?? [];

  const handleSkillClick = (skill: StoredSkillResponse) => {
    setSelectedSkill(skill);
  };

  const body = (() => {
    if (isLoading) {
      return <SkillBuilderListSkeleton />;
    }

    if (error) {
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
            <PermissionDenied resource="skills" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center pt-10">
          <ErrorState title="Failed to load skills" message={error.message} />
        </div>
      );
    }

    if (skills.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<SparklesIcon className="h-8 w-8 text-neutral3" />}
            titleSlot={scope === 'mine' ? 'No skills yet' : 'No skills available'}
            descriptionSlot={
              scope === 'mine'
                ? 'Create your first skill to give agents new capabilities.'
                : 'No public skills are available yet.'
            }
            actionSlot={
              scope === 'mine' ? (
                <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                  <PlusIcon /> New skill
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }

    return <SkillBuilderList skills={skills} search={search} onSkillClick={handleSkillClick} />;
  })();

  return (
    <>
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <div className="flex items-start justify-between gap-4">
            <PageHeader>
              <PageHeader.Title>
                <SparklesIcon /> {scope === 'mine' ? 'My skills' : 'All skills'}
              </PageHeader.Title>
              <PageHeader.Description>
                {scope === 'mine' ? "Skills you've created in Agent Builder." : 'All skills you have access to.'}
              </PageHeader.Description>
            </PageHeader>
            {skills.length > 0 && scope === 'mine' && (
              <div className="shrink-0">
                <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                  <PlusIcon /> New skill
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-border1 overflow-hidden">
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope === 'mine' ? 'bg-surface4 text-neutral6' : 'bg-surface2 text-neutral3 hover:text-neutral5'
                }`}
              >
                My skills
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope === 'all' ? 'bg-surface4 text-neutral6' : 'bg-surface2 text-neutral3 hover:text-neutral5'
                }`}
              >
                All skills
              </button>
            </div>
            <div className="flex-1 max-w-120">
              <ListSearch onSearch={setSearch} label="Filter skills" placeholder="Filter by name or description" />
            </div>
          </div>
        </EntityListPageLayout.Top>

        {body}
      </EntityListPageLayout>

      <SkillEditDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSkillCreated={() => setIsCreateDialogOpen(false)}
        currentUserId={currentUser?.id}
        isAdmin={isAdmin}
      />

      <SkillEditDialog
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        skill={selectedSkill ?? undefined}
        onSkillUpdated={() => setSelectedSkill(null)}
        currentUserId={currentUser?.id}
        isAdmin={isAdmin}
      />
    </>
  );
}
