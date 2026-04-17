import type { StoredSkillResponse } from '@mastra/client-js';
import { DashboardCard, truncateString } from '@mastra/playground-ui';
import { SparklesIcon } from 'lucide-react';

import { StarButton } from './star-button';
import { resolveVisibility } from './visibility';
import { VisibilityBadge } from './visibility-badge';
import { useLinkComponent } from '@/lib/framework';

export interface SkillStudioCardProps {
  skill: StoredSkillResponse;
  linkBasePath: string;
  showAuthor?: boolean;
  currentUserId?: string;
  /** Render the star toggle (marketplace view). */
  showStar?: boolean;
  /** Render the visibility badge. Default: true. */
  showVisibility?: boolean;
}

export function SkillStudioCard({
  skill,
  linkBasePath,
  showAuthor = false,
  currentUserId,
  showStar = false,
  showVisibility = true,
}: SkillStudioCardProps) {
  const { Link } = useLinkComponent();
  const url = `${linkBasePath}/${skill.id}`;
  const authorLabel = skill.authorId ? (skill.authorId === currentUserId ? 'You' : skill.authorId) : 'Unknown author';
  const visibility = skill.visibility ?? resolveVisibility(skill.metadata);

  return (
    <Link href={url} data-testid={`skill-studio-card-${skill.id}`}>
      <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface4 text-icon4 border border-border1">
            <SparklesIcon className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate text-sm">{skill.name || skill.id}</span>
              {showVisibility && <VisibilityBadge visibility={visibility} />}
            </div>
            {showAuthor && (
              <p className="text-xs text-icon3 mt-0.5">
                by <span className="text-icon4">{authorLabel}</span>
              </p>
            )}
          </div>
          {showStar && <StarButton kind="skill" id={skill.id} />}
        </div>
        <p className="text-xs text-icon4 min-h-[2.5rem]">
          {truncateString(skill.description ?? '', 160) || 'No description'}
        </p>
      </DashboardCard>
    </Link>
  );
}
