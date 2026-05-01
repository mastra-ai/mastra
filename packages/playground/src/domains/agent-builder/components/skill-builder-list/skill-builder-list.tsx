import type { StoredSkillResponse } from '@mastra/client-js';
import { EmptyState, Icon, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { LockIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { useMemo } from 'react';
import { SkillStarButton } from '@/domains/agents/components/skill-star-button';

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < month) return `${Math.floor(diff / week)}w ago`;
  if (diff < year) return `${Math.floor(diff / month)}mo ago`;
  return `${Math.floor(diff / year)}y ago`;
}

export type SkillBuilderListProps = {
  skills: StoredSkillResponse[];
  search?: string;
  onSkillClick?: (skill: StoredSkillResponse) => void;
};

export function SkillBuilderList({ skills, search, onSkillClick }: SkillBuilderListProps) {
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
            <div className="bg-surface3 p-2 rounded-md text-neutral5 flex items-center justify-center">
              <SparklesIcon className="h-5 w-5" />
            </div>
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
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-ui-sm text-neutral3 line-clamp-1">{skill.description || 'No description'}</span>
              </div>
            </div>
            <div className="hidden sm:inline-flex items-center gap-4 text-ui-sm text-neutral3 shrink-0">
              <span className="hidden lg:inline-flex">Updated {formatRelativeTime(skill.updatedAt)}</span>
            </div>
            <SkillStarButton
              skillId={skill.id}
              isStarred={skill.isStarred}
              starCount={skill.starCount}
              size="sm"
              className="shrink-0"
            />
          </>
        );

        return onSkillClick ? (
          <button
            key={skill.id}
            className="px-6 py-5 flex items-center gap-4 w-full text-left hover:bg-surface3/50 transition-colors"
            onClick={() => onSkillClick(skill)}
          >
            {row}
          </button>
        ) : (
          <div key={skill.id} className="px-6 py-5 flex items-center gap-4">
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
