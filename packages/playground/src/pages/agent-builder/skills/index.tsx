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
import { DownloadIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  SkillBuilderList,
  SkillBuilderListSkeleton,
} from '@/domains/agent-builder/components/skill-builder-list/skill-builder-list';
import { BuilderAddSkillDialog } from '@/domains/agents/components/agent-cms-pages/builder-add-skill-dialog';
import { SkillEditDialog } from '@/domains/agents/components/agent-cms-pages/skill-edit-dialog';
import { useBuilderRegistries } from '@/domains/agents/hooks/use-builder-registries';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export default function AgentBuilderSkillsPage() {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const { hasPermission, rbacEnabled } = usePermissions();
  const canWriteSkills = !rbacEnabled || hasPermission('stored-skills:write');
  const canReadSkills = !rbacEnabled || hasPermission('stored-skills:read');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [registryDialog, setRegistryDialog] = useState<{ id: string; label: string } | null>(null);
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

  const skills = useMemo(() => data?.skills ?? [], [data?.skills]);
  const installedSkillIds = useMemo(() => skills.map(s => s.id), [skills]);

  // Surface registry browse only for users who can read AND write skills, and
  // only when at least one registry is actually enabled. This is the gate
  // requested in COR-832: invisible when there's nothing useful to do.
  const { data: registriesData } = useBuilderRegistries({ enabled: canReadSkills && canWriteSkills });
  const enabledRegistry = useMemo(() => registriesData?.registries.find(r => r.enabled) ?? null, [registriesData]);

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
              canWriteSkills ? (
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                    <PlusIcon /> New skill
                  </Button>
                  {enabledRegistry && (
                    <Button
                      variant="default"
                      onClick={() => setRegistryDialog({ id: enabledRegistry.id, label: enabledRegistry.label })}
                    >
                      <DownloadIcon /> Browse {enabledRegistry.label}
                    </Button>
                  )}
                </div>
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
      <PageLayout>
        <PageLayout.TopArea>
          <div className="flex items-start justify-between gap-4">
            <PageHeader>
              <PageHeader.Title>
                <SparklesIcon /> My skills
              </PageHeader.Title>
              <PageHeader.Description>Skills you've created.</PageHeader.Description>
            </PageHeader>
            {skills.length > 0 && canWriteSkills && (
              <div className="shrink-0 flex items-center gap-2">
                {enabledRegistry && (
                  <Button
                    variant="default"
                    onClick={() => setRegistryDialog({ id: enabledRegistry.id, label: enabledRegistry.label })}
                  >
                    <DownloadIcon /> Browse {enabledRegistry.label}
                  </Button>
                )}
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
        isAdmin={canWriteSkills}
      />

      <SkillEditDialog
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        skill={selectedSkill ?? undefined}
        onSkillUpdated={() => setSelectedSkill(null)}
        currentUserId={currentUser?.id}
        isAdmin={canWriteSkills}
      />

      {registryDialog && (
        <BuilderAddSkillDialog
          open={!!registryDialog}
          onOpenChange={open => {
            if (!open) setRegistryDialog(null);
          }}
          registryId={registryDialog.id}
          registryLabel={registryDialog.label}
          installedSkillIds={installedSkillIds}
          onInstalled={storedSkillId => {
            const installed = skills.find(s => s.id === storedSkillId);
            toast.success(installed ? `Imported "${installed.name}"` : 'Skill imported');
          }}
          onCollision={skillName => {
            const existing = skills.find(s => s.id === skillName || s.name === skillName);
            if (existing) {
              toast.error(`"${existing.name}" is already in your library`, {
                action: {
                  label: 'Open existing',
                  onClick: () => setSelectedSkill(existing),
                },
              });
            } else {
              toast.error(`A skill named "${skillName}" already exists.`);
            }
          }}
        />
      )}
    </>
  );
}
