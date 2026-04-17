import { PageHeader, PageLayout } from '@mastra/playground-ui';
import { ArrowLeftIcon, SparklesIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { SkillForm } from '@/domains/agent-studio/components/skill-form';
import { useStoredSkillMutations } from '@/domains/agent-studio/hooks/use-studio-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

export function AgentStudioConfigureSkillCreate() {
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { data: user } = useCurrentUser();
  const { createStoredSkill } = useStoredSkillMutations();

  const handleSubmit = async (values: { name: string; description: string; instructions: string; license: string }) => {
    try {
      const skill = await createStoredSkill.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim(),
        instructions: values.instructions,
        license: values.license.trim() || undefined,
        authorId: user?.id,
      });
      toast.success('Skill created');
      void navigate(`/agent-studio/configure/skills/${skill.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create skill');
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
              <PageHeader.Title>
                <SparklesIcon /> New skill
              </PageHeader.Title>
              <PageHeader.Description>
                Give your skill a name, a short description, and the instructions an agent should follow.
              </PageHeader.Description>
            </PageHeader>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <div className="p-4">
        <SkillForm
          submitLabel="Create skill"
          isSubmitting={createStoredSkill.isPending}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/agent-studio/configure/skills')}
        />
      </div>
    </PageLayout>
  );
}

export default AgentStudioConfigureSkillCreate;
