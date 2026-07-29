import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckCircle2, CircleDot, CircleX, GitCompareArrows, GitPullRequest } from 'lucide-react';
import type { ComponentType } from 'react';

import type { WorkItemSource } from '../services/workItems';
import type { BoardStageId } from '../stages';

export const SOURCE_ICONS: Record<
  WorkItemSource,
  { icon: ComponentType<{ size?: number; className?: string }>; className: string }
> = {
  'github-issue': { icon: IssueSourceIcon, className: '' },
  'github-pr': { icon: GitCompareArrows, className: 'text-accent1' },
  'linear-issue': { icon: CircleDot, className: 'text-accent3' },
  manual: { icon: CircleDot, className: 'text-icon3' },
};

const STAGE_ICON_SOURCES: Partial<Record<BoardStageId, string>> = {
  triage: '/factory-stage-icons/triage.svg',
  planning: '/factory-stage-icons/in-progress.svg',
  execute: '/factory-stage-icons/in-progress.svg',
};

export function BoardStageIcon({ stage }: { stage: BoardStageId }) {
  if (stage === 'intake') return <ArrowRightCircleIcon className="shrink-0 text-[#939393]" />;
  if (stage === 'review') return <GitPullRequest size={16} className="text-icon3 shrink-0" aria-hidden />;
  const source = STAGE_ICON_SOURCES[stage];
  if (source) return <img src={source} alt="" aria-hidden className="size-4 shrink-0" />;
  const Icon = stage === 'done' ? CheckCircle2 : CircleX;
  return <Icon size={16} className="text-icon3 shrink-0" aria-hidden />;
}

function ArrowRightCircleIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 14.67C11.68 14.67 14.67 11.68 14.67 8C14.67 4.32 11.68 1.33 8 1.33C4.32 1.33 1.33 4.32 1.33 8C1.33 11.68 4.32 14.67 8 14.67ZM9.14 5.53C8.88 5.27 8.46 5.27 8.2 5.53C7.93 5.79 7.93 6.21 8.2 6.47L9.06 7.33H5.33C4.97 7.33 4.67 7.63 4.67 8C4.67 8.37 4.97 8.67 5.33 8.67H9.06L8.2 9.53C7.93 9.79 7.93 10.21 8.2 10.47C8.46 10.73 8.88 10.73 9.14 10.47L11.14 8.47C11.4 8.21 11.4 7.79 11.14 7.53L9.14 5.53Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IssueSourceIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <ArrowRightCircleIcon size={size} className={cn('text-[#6CCDFB]', className)} />;
}
