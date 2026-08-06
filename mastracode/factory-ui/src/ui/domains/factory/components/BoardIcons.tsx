import { cn } from '@mastra/playground-ui/utils/cn';
import {
  CheckCircle2,
  CircleDot,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { SlackLogo } from '../../../ui/SlackLogo';
import type { WorkItem, WorkItemSource } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { IntakeIcon } from './IntakeIcon';

export const SOURCE_ICONS: Record<
  WorkItemSource,
  { icon: ComponentType<{ size?: number; className?: string }>; className: string }
> = {
  'github-issue': { icon: IssueSourceIcon, className: '' },
  'github-pr': { icon: GitPullRequest, className: 'text-accent1' },
  'linear-issue': { icon: CircleDot, className: 'text-accent3' },
  'slack-thread': { icon: SlackLogo, className: '' },
  manual: { icon: CircleDot, className: 'text-icon3' },
};

type PullRequestStatus = 'draft' | 'open' | 'closed' | 'merged';

function pullRequestStatus(item: Pick<WorkItem, 'metadata' | 'stages'>): PullRequestStatus {
  if (item.metadata.merged === true) return 'merged';
  if (item.metadata.state === 'closed') return 'closed';
  if (item.metadata.state === 'open') return item.metadata.draft === true ? 'draft' : 'open';
  if (item.stages.includes('done')) return 'merged';
  if (item.stages.includes('canceled')) return 'closed';
  return item.metadata.draft === true ? 'draft' : 'open';
}

export function PullRequestStatusIcon({ item }: { item: Pick<WorkItem, 'metadata' | 'stages'> }) {
  const status = pullRequestStatus(item);
  const label = `${status[0]?.toUpperCase()}${status.slice(1)} pull request`;
  if (status === 'merged') return <GitMerge size={16} className="shrink-0 text-purple-400" aria-label={label} />;
  if (status === 'closed') return <GitPullRequestClosed size={16} className="text-error shrink-0" aria-label={label} />;
  if (status === 'draft') return <GitPullRequestDraft size={16} className="text-icon3 shrink-0" aria-label={label} />;
  return <GitPullRequest size={16} className="text-accent1 shrink-0" aria-label={label} />;
}

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
