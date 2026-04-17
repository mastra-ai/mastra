import { Button, ErrorState, NoDataPageLayout, PageHeader, PageLayout } from '@mastra/playground-ui';
import { ArrowLeftIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { SkillForm } from '@/domains/agent-studio/components/skill-form';
import { SkillSharingPanel } from '@/domains/agent-studio/components/skill-sharing-panel';
import { useStoredSkill, useStoredSkillMutations } from '@/domains/agent-studio/hooks/use-studio-skills';
import { useLinkComponent } from '@/lib/framework';

export function AgentStudioConfigureSkillEdit() {
  const { skillId } = useParams<{ skillId: string }>();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { data: skill, isLoading, error } = useStoredSkill(skillId);
  const { updateStoredSkill, deleteStoredSkill } = useStoredSkillMutations();

  if (error) {
    return (
      <NoDataPageLayout title="Skill" icon={<SparklesIcon />}>
        <ErrorState title="Failed to load skill" message={(error as Error).message} />
      </NoDataPageLayout>
    );
  }

  if (!isLoading && !skill) {
    return (
      <NoDataPageLayout title="Skill" icon={<SparklesIcon />}>
        <ErrorState title="Skill not found" message={`No skill with id ${skillId}`} />
      </NoDataPageLayout>
    );
  }

  const handleSubmit = async (values: { name: string; description: string; instructions: string; license: string }) => {
    if (!skillId) return;
    try {
      await updateStoredSkill.mutateAsync({
        skillId,
        params: {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          instructions: values.instructions,
          license: values.license.trim() || undefined,
        },
      });
      toast.success('Skill updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update skill');
    }
  };

  const handleDelete = async () => {
    if (!skillId) return;
    const confirmed = window.confirm('Delete this skill? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteStoredSkill.mutateAsync(skillId);
      toast.success('Skill deleted');
      void navigate('/agent-studio/configure/skills');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete skill');
    }
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <Link
              href="/agent-studio/configure/skills"
              className="inline-flex items-center gap-1 text-sm text-icon4 hover:text-icon6"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Back to your skills
            </Link>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <SparklesIcon /> {skill?.name ?? 'Edit skill'}
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column>
            <Button
              variant="light"
              onClick={handleDelete}
              disabled={deleteStoredSkill.isPending || !skill}
              data-testid="skill-delete"
            >
              <Trash2Icon /> Delete
            </Button>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {skill && skillId && (
        <div className="px-4 pt-4">
          <SkillSharingPanel skillId={skillId} />
        </div>
      )}

      {skill && (
        <div className="p-4">
          <SkillForm
            submitLabel="Save changes"
            initialValues={{
              name: skill.name,
              description: skill.description ?? '',
              instructions: skill.instructions,
              license: skill.license ?? '',
            }}
            isSubmitting={updateStoredSkill.isPending}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </PageLayout>
  );
}

export default AgentStudioConfigureSkillEdit;
