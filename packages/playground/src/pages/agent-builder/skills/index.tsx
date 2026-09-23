import type { StoredSkillResponse } from '@mastra/client-js';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { DownloadIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BuilderAddSkillDialog } from '@/domains/agent-builder/components/skill-list/builder-add-skill-dialog';
import {
  SkillBuilderList,
  SkillBuilderListSkeleton,
} from '@/domains/agent-builder/components/skill-list/skill-builder-list';
import { useBuilderRegistries } from '@/domains/agent-builder/hooks/use-builder-registries';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export default function AgentBuilderSkillsPage() {
  const navigate = useNavigate();
  const { isLoading: isCurrentUserLoading } = useCurrentUser();
  const { hasPermission, rbacEnabled } = usePermissions();
  const canWriteSkills = !rbacEnabled || hasPermission('stored-skills:write');
  const canReadSkills = !rbacEnabled || hasPermission('stored-skills:read');
  const [registryDialog, setRegistryDialog] = useState<{ id: string; label: string } | null>(null);

  const goToCreate = () => navigate('/agent-builder/skills/create', { viewTransition: true });
  const goToEdit = (skillId: string) => navigate(`/agent-builder/skills/${skillId}/edit`, { viewTransition: true });

  const { data, isLoading, error } = useStoredSkills({ enabled: !isCurrentUserLoading });
  const [search, setSearch] = useState('');

  const skills = useMemo(() => data?.skills ?? [], [data?.skills]);
  const installedSkillIds = useMemo(() => skills.map(s => s.id), [skills]);

  // Surface registry browse only for users who can read AND write skills, and
  // only when at least one registry is actually enabled. This is the gate
  // requested in COR-832: invisible when there's nothing useful to do.
  const { data: registriesData } = useBuilderRegistries({ enabled: canReadSkills && canWriteSkills });
  const enabledRegistry = useMemo(() => registriesData?.registries.find(r => r.enabled) ?? null, [registriesData]);

  const handleSkillClick = (skill: StoredSkillResponse) => {
    void goToEdit(skill.id);
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
        <div className="flex items-center-safe justify-center-safe">
          <EmptyState
            titleSlot="No skills yet"
            descriptionSlot="Create your first skill to give agents new capabilities."
            actionSlot={
              canWriteSkills ? (
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={goToCreate} icon={<PlusIcon />}>
                    New skill
                  </Button>
                  {enabledRegistry && (
                    <Button
                      variant="default"
                      onClick={() => setRegistryDialog({ id: enabledRegistry.id, label: enabledRegistry.label })}
                      icon={<DownloadIcon />}
                    >
                      Browse registry
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
      <PageLayout
        actionRow={
          <>
            <ActionRow className="items-start">
              <ActionRow.Start>
                <PageHeader>
                  <PageHeader.Title>
                    <SparklesIcon /> My skills
                  </PageHeader.Title>
                  <PageHeader.Description>Skills you've created.</PageHeader.Description>
                </PageHeader>
              </ActionRow.Start>
              {skills.length > 0 && canWriteSkills && (
                <ActionRow.End>
                  {enabledRegistry && (
                    <Button
                      variant="default"
                      onClick={() => setRegistryDialog({ id: enabledRegistry.id, label: enabledRegistry.label })}
                      icon={<DownloadIcon />}
                    >
                      Browse registry
                    </Button>
                  )}
                  <Button variant="primary" onClick={goToCreate} icon={<PlusIcon />}>
                    New skill
                  </Button>
                </ActionRow.End>
              )}
            </ActionRow>
            <ActionRow>
              <ActionRow.Start>
                <div className="max-w-120 flex-1">
                  <ListSearch onSearch={setSearch} label="Filter skills" placeholder="Filter by name or description" />
                </div>
              </ActionRow.Start>
            </ActionRow>
          </>
        }
      >
        {body}
      </PageLayout>

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
                  onClick: () => goToEdit(existing.id),
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
