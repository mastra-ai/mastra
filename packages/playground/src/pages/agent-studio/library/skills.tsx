import {
  EmptyState,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { SparklesIcon, StoreIcon } from 'lucide-react';
import { useState } from 'react';
import { SkillStudioCard } from '@/domains/agent-studio/components/skill-studio-card';
import { useStudioSkills } from '@/domains/agent-studio/hooks/use-studio-skills';
import { useUserLookup } from '@/domains/agent-studio/hooks/use-user-lookup';

export function AgentStudioLibrarySkills() {
  const [search, setSearch] = useState('');
  const { skills, isLoading, error, currentUserId } = useStudioSkills({
    scope: 'team',
    search,
    visibility: 'public',
  });
  const { getDisplayName } = useUserLookup(skills.map(s => s.authorId));

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Library — Skills" icon={<StoreIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Library — Skills" icon={<StoreIcon />}>
        <PermissionDenied resource="skills" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Library — Skills" icon={<StoreIcon />}>
        <ErrorState title="Failed to load library skills" message={(error as Error).message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <StoreIcon /> Library — Skills
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter skills" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      {!isLoading && skills.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8">
          <EmptyState
            iconSlot={<SparklesIcon />}
            titleSlot="No teammate skills yet"
            descriptionSlot="When your teammates publish skills, they'll appear here for discovery."
          />
        </div>
      ) : (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
          data-testid="library-skills-grid"
        >
          {skills.map(skill => (
            <SkillStudioCard
              key={skill.id}
              skill={skill}
              linkBasePath="/agent-studio/library/skills"
              showAuthor
              currentUserId={currentUserId}
              authorDisplayName={getDisplayName(skill.authorId)}
              showStar
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default AgentStudioLibrarySkills;
