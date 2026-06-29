import type { StoredSkillResponse } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CopyIcon, DownloadIcon, LockIcon, SearchIcon } from 'lucide-react';
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
      <div className="flex items-center justify-center pt-10">
        <EmptyState
          iconSlot={<SearchIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No skills match your search"
          descriptionSlot="Try a different name or description."
        />
      </div>
    );
  }

  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {filtered.map(skill => {
        const row = (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-ui-md text-neutral6 truncate">{skill.name}</div>
                {skill.visibility === 'private' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-neutral3 shrink-0"
                        aria-label="Private skill"
                        data-testid="skill-builder-private-visibility-icon"
                      >
                        <Icon size="sm">
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
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface5 text-neutral4 shrink-0"
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
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-ui-sm text-neutral3 line-clamp-1">{skill.description || 'No description'}</span>
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
                className="shrink-0 hidden md:inline-flex"
              />
            )}
          </>
        );

        return onSkillClick ? (
          <button
            key={skill.id}
            className="px-6 py-5 flex items-start gap-4 w-full text-left hover:bg-surface3/50 transition-colors md:items-center"
            onClick={() => onSkillClick(skill)}
          >
            {row}
          </button>
        ) : (
          <div key={skill.id} className="px-6 py-5 flex items-start gap-4 md:items-center">
            {row}
          </div>
        );
      })}
    </div>
  );
}

export function SkillBuilderListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-5 flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-48 bg-surface3 rounded animate-pulse" />
            <div className="h-3 w-72 max-w-full bg-surface3 rounded animate-pulse" />
          </div>
          <div className="h-3 w-16 bg-surface3 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
