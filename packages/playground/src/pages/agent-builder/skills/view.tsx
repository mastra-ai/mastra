import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { CopySkillDialog } from '@/domains/agent-builder/components/skill-list/copy-skill-dialog';
import { SkillFavoriteButton } from '@/domains/agent-builder/components/skill-list/skill-favorite-button';
import { useCopySkill } from '@/domains/agent-builder/hooks/use-copy-skill';
import { useStoredSkill } from '@/domains/agent-builder/hooks/use-stored-skill';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export default function AgentBuilderSkillsView() {
  const { id } = useParams<{ id: string }>();
  const { data: storedSkill, isLoading: isStoredSkillLoading } = useStoredSkill(id);
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();

  const isOwner = !storedSkill?.authorId || currentUser?.id === storedSkill.authorId;
  const isOwnershipLoading = Boolean(storedSkill?.authorId) && isCurrentUserLoading;
  const isReady = Boolean(id) && !isStoredSkillLoading && !isOwnershipLoading;

  if (!isReady) {
    return <AgentBuilderSkillViewSkeleton />;
  }

  if (!storedSkill) {
    return <Navigate to="/agent-builder/skills" replace />;
  }

  if (isOwner) {
    return <Navigate to={`/agent-builder/skills/${id}/edit`} replace />;
  }

  return <AgentBuilderSkillViewPage skill={storedSkill} />;
}

const AgentBuilderSkillViewSkeleton = () => (
  <div className="flex h-screen w-screen items-center justify-center">
    <Spinner />
  </div>
);

interface PageProps {
  skill: NonNullable<ReturnType<typeof useStoredSkill>['data']>;
}

const AgentBuilderSkillViewPage = ({ skill }: PageProps) => {
  const navigate = useNavigate();
  const { hasPermission, rbacEnabled } = usePermissions();
  const canCopy = !rbacEnabled || hasPermission('stored-skills:write');
  const [copyOpen, setCopyOpen] = useState(false);
  const copySkill = useCopySkill();

  // Suggest a non-colliding copy name based on the caller's own skills.
  const { data: ownSkillsData } = useStoredSkills({ enabled: canCopy });
  const ownSkillNames = (ownSkillsData?.skills ?? []).map(s => s.name);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="skill-view-page">
      {/* Header */}
      <div className="bg-surface1 flex min-w-0 items-center gap-2 px-3 py-2 md:px-6 md:py-3">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => navigate('/agent-builder/skills', { viewTransition: true })}
          className="rounded-full"
          tooltip="Skills list"
          data-testid="skill-view-back-button"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="text-ui-md text-neutral6 min-w-0 truncate" data-testid="skill-view-title">
            {skill.name}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SkillFavoriteButton
            skillId={skill.id}
            isFavorited={skill.isFavorited}
            favoriteCount={skill.favoriteCount}
            className=""
          />
          {canCopy && (
            <Button
              type="button"
              variant="default"
              size="md"
              onClick={() => setCopyOpen(true)}
              data-testid="skill-view-copy-button"
            >
              <PlusIcon />
              Copy to my skills
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-surface1 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[80ch] px-4 pt-6 pb-10 md:px-10">
          <h1 className="text-display-md text-neutral6">{skill.name}</h1>
          {skill.description && (
            <p className="text-ui-md text-neutral4 mt-2" data-testid="skill-view-description">
              {skill.description}
            </p>
          )}
          <div className="mt-6" data-testid="skill-view-instructions">
            <MarkdownRenderer>{skill.instructions ?? ''}</MarkdownRenderer>
          </div>
        </div>
      </div>

      {copyOpen && (
        <CopySkillDialog
          open={copyOpen}
          onOpenChange={open => {
            if (!open && !copySkill.isPending) setCopyOpen(false);
          }}
          sourceName={skill.name}
          existingNames={ownSkillNames}
          isPending={copySkill.isPending}
          onConfirm={async name => {
            try {
              const created = await copySkill.mutateAsync({ source: skill, name });
              setCopyOpen(false);
              void navigate(`/agent-builder/skills/${created.id}/edit`, { viewTransition: true });
            } catch {
              // Errors surfaced via the mutation's onError toast; keep dialog open.
            }
          }}
        />
      )}
    </div>
  );
};
