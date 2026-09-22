import type { StoredSkillResponse } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CopyIcon, DownloadIcon, LockIcon, CircleSlashIcon } from 'lucide-react';
import { useMemo } from 'react';
import { SkillFavoriteButton } from './skill-favorite-button';
import { getSkillOrigin } from '@/domains/agent-builder/utils/skill-origin';

export type SkillBuilderListProps = {
  skills: StoredSkillResponse[];
  search?: string;
  onSkillClick?: (skill: StoredSkillResponse) => void;
  showFavorites?: boolean;
};

export function SkillBuilderList({ skills, search, onSkillClick, showFavorites = true }: SkillBuilderListProps) {
  const filtered = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(s => {
      const name = s.name?.toLowerCase() ?? '';
      const description = s.description?.toLowerCase() ?? '';
      return name.includes(q) || description.includes(q);
    });
  }, [skills, search]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center-safe justify-center-safe">
        <EmptyState
          iconSlot={<CircleSlashIcon className="h-8 w-8 text-muted-foreground" />}
          titleSlot="No skills match your search"
          descriptionSlot="Try a different name or description."
        />
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
      {filtered.map(skill => {
        const row = (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-body text-foreground">{skill.name}</div>
                {skill.visibility === 'private' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="shrink-0 text-muted-foreground"
                        aria-label="Private skill"
                        data-testid="skill-builder-private-visibility-icon"
                      >
                        <Icon size="xs">
                          <LockIcon />
                        </Icon>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Only visible to you</TooltipContent>
                  </Tooltip>
                )}
                {(() => {
                  const origin = getSkillOrigin(skill.metadata);
                  if (!origin) return null;
                  const isCopy = origin.type === 'library-copy';
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded bg-card px-1.5 py-0.5 text-meta text-muted-foreground"
                          aria-label={isCopy ? 'Copied skill' : 'Imported skill'}
                          data-testid="skill-builder-origin-badge"
                        >
                          {isCopy ? <CopyIcon className="h-2.5 w-2.5" /> : <DownloadIcon className="h-2.5 w-2.5" />}
                          {origin.type === 'skills-sh' ? 'skills.sh' : isCopy ? 'copied' : 'imported'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {origin.type === 'skills-sh'
                          ? `Imported from ${origin.owner}/${origin.repo}`
                          : isCopy
                            ? `Copied from "${origin.sourceSkillName}"`
                            : 'Imported from external registry'}
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="line-clamp-1 text-caption text-muted-foreground">
                  {skill.description || 'No description'}
                </span>
              </div>
              {showFavorites && (
                <div className="mt-2 md:hidden">
                  <SkillFavoriteButton
                    skillId={skill.id}
                    isFavorited={skill.isFavorited}
                    favoriteCount={skill.favoriteCount}
                    size="sm"
                  />
                </div>
              )}
            </div>
            {showFavorites && (
              <SkillFavoriteButton
                skillId={skill.id}
                isFavorited={skill.isFavorited}
                favoriteCount={skill.favoriteCount}
                size="sm"
                className="hidden shrink-0 md:inline-flex"
              />
            )}
          </>
        );

        return onSkillClick ? (
          <button
            key={skill.id}
            className="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-fill-subtle md:items-center"
            onClick={() => onSkillClick(skill)}
          >
            {row}
          </button>
        ) : (
          <div key={skill.id} className="flex items-start gap-4 px-4 py-3 md:items-center">
            {row}
          </div>
        );
      })}
    </div>
  );
}

export function SkillBuilderListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-48 animate-pulse rounded bg-card" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-card" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-card" />
        </div>
      ))}
    </div>
  );
}
