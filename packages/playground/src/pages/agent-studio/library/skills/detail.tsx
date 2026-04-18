import { Badge, ErrorState, MarkdownRenderer, NoDataPageLayout, PageHeader, PageLayout } from '@mastra/playground-ui';
import { SparklesIcon, ArrowLeftIcon } from 'lucide-react';
import { useParams } from 'react-router';
import { useStoredSkill } from '@/domains/agent-studio/hooks/use-studio-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

export function AgentStudioLibrarySkillDetail() {
  const { skillId } = useParams<{ skillId: string }>();
  const { Link } = useLinkComponent();
  const { data: skill, isLoading, error } = useStoredSkill(skillId);
  const { data: user } = useCurrentUser();

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

  const authorLabel = skill?.authorId ? (skill.authorId === user?.id ? 'You' : skill.authorId) : 'Unknown author';

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <Link
              href="/agent-studio/library/skills"
              className="inline-flex items-center gap-1 text-sm text-icon4 hover:text-icon6"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Back to library
            </Link>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <SparklesIcon /> {skill?.name ?? skillId}
              </PageHeader.Title>
              {skill?.description && <PageHeader.Description>{skill.description}</PageHeader.Description>}
            </PageHeader>
            {skill && (
              <div className="flex items-center gap-2 text-xs text-icon4">
                <Badge>by {authorLabel}</Badge>
                {skill.license && <Badge>License: {skill.license}</Badge>}
                <span>Updated {new Date(skill.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {skill && (
        <div className="p-4 space-y-4">
          <section>
            <h2 className="text-lg font-medium mb-2">Instructions</h2>
            <div className="rounded-md border border-border1 p-4 bg-surface2">
              <MarkdownRenderer>{skill.instructions}</MarkdownRenderer>
            </div>
          </section>
        </div>
      )}
    </PageLayout>
  );
}

export default AgentStudioLibrarySkillDetail;
