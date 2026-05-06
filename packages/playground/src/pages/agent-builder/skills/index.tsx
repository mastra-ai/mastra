import type { ListStoredSkillsParams, StoredSkillResponse } from '@mastra/client-js';
import {
  Button,
  EmptyState,
  ErrorState,
  ListSearch,
  PageHeader,
  PageLayout,
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

export default function AgentBuilderSkillsPage() {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isAdmin = currentUser?.permissions?.includes('*') ?? false;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<StoredSkillResponse | null>(null);

  const listParams = useMemo<ListStoredSkillsParams>(() => {
    const params: ListStoredSkillsParams = {};
    if (currentUser?.id) {
      params.authorId = currentUser.id;
    }
    return params;
  }, [currentUser?.id]);

  const { data, isLoading, error } = useStoredSkills(listParams, { enabled: !isCurrentUserLoading });
  const [search, setSearch] = useState('');

  const skills = data?.skills ?? [];

  const handleSkillClick = (skill: StoredSkillResponse) => {
    setSelectedSkill(skill);
  };

  const body = (() => {
    if (isCurrentUserLoading || isLoading) {
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
            titleSlot="No skills yet"
            descriptionSlot="Create your first skill to give agents new capabilities."
            actionSlot={
              <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                <PlusIcon /> New skill
              </Button>
            }
          />
        </div>
      );
    }

    return <SkillBuilderList skills={skills} search={search} onSkillClick={handleSkillClick} />;
  })();

  return (
    <>
      <PageLayout>
        <PageLayout.TopArea>
          <div className="flex items-start justify-between gap-4">
            <PageHeader>
              <PageHeader.Title>
                <SparklesIcon /> My skills
              </PageHeader.Title>
              <PageHeader.Description>Skills you've created.</PageHeader.Description>
            </PageHeader>
            {skills.length > 0 && (
              <div className="shrink-0">
                <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                  <PlusIcon /> New skill
                </Button>
              </div>
            )}
          </div>
          <div className="max-w-120">
            <ListSearch onSearch={setSearch} label="Filter skills" placeholder="Filter by name or description" />
          </div>
        </PageLayout.TopArea>

        {body}
      </PageLayout>

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
