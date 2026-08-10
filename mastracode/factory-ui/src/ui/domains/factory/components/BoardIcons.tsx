import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckCircle2, CircleDot, CircleX, GitPullRequest } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { WorkItemSource } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { IntakeIcon } from './IntakeIcon';

// GitHub keeps issue vs PR distinct — card meta shows #N for both
const SOURCE_ICONS: Record<WorkItemSource, { icon: ComponentType<SVGProps<SVGSVGElement>>; className: string }> = {
  'github-issue': { icon: GithubIcon, className: 'text-icon5' },
  'github-pr': { icon: GitPullRequest, className: 'text-accent1' },
  'linear-issue': { icon: LinearIcon, className: 'text-accent3' },
  'slack-thread': { icon: SlackIcon, className: '' },
  manual: { icon: CircleDot, className: 'text-icon3' },
};

export function SourceIcon({ source, className }: { source: WorkItemSource; className?: string }) {
  const { icon: Icon, className: sourceClassName } = SOURCE_ICONS[source];
  return <Icon data-source={source} className={cn('size-4 shrink-0', sourceClassName, className)} aria-hidden />;
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
