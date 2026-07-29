import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckCircle2, CircleDot, CircleX, GitCompareArrows, GitPullRequest } from 'lucide-react';
import type { ComponentType } from 'react';

import type { WorkItemSource } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { IntakeIcon } from './IntakeIcon';

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
  if (stage === 'intake') return <IntakeIcon className="text-icon3 shrink-0" />;
  if (stage === 'review') return <GitPullRequest size={16} className="text-icon3 shrink-0" aria-hidden />;
  const source = STAGE_ICON_SOURCES[stage];
  if (source) return <img src={source} alt="" aria-hidden className="size-4 shrink-0" />;
  const Icon = stage === 'done' ? CheckCircle2 : CircleX;
  return <Icon size={16} className="text-icon3 shrink-0" aria-hidden />;
}

export function IssueSourceIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <IntakeIcon size={size} className={cn('text-[#6CCDFB]', className)} />;
}
