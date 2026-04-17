import type { StoredSkillResponse } from '@mastra/client-js';
import { DashboardCard, truncateString } from '@mastra/playground-ui';
import { SparklesIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

export interface SkillStudioCardProps {
  skill: StoredSkillResponse;
  linkBasePath: string;
  showAuthor?: boolean;
  currentUserId?: string;
}

export function SkillStudioCard({ skill, linkBasePath, showAuthor = false, currentUserId }: SkillStudioCardProps) {
  const { Link } = useLinkComponent();
  const url = `${linkBasePath}/${skill.id}`;
  const authorLabel = skill.authorId ? (skill.authorId === currentUserId ? 'You' : skill.authorId) : 'Unknown author';

  return (
    <Link href={url} data-testid={`skill-studio-card-${skill.id}`}>
      <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <SparklesIcon className="h-4 w-4" />
          <span className="font-medium truncate">{skill.name || skill.id}</span>
        </div>
        <p className="text-xs text-icon4 min-h-[2.5rem]">
          {truncateString(skill.description ?? '', 160) || 'No description'}
        </p>
        {showAuthor && (
          <p className="text-xs text-icon3">
            by <span className="text-icon4">{authorLabel}</span>
          </p>
        )}
      </DashboardCard>
    </Link>
  );
}
