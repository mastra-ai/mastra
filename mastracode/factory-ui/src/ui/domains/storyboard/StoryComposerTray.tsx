import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { StoryFix } from './storyLinks';
import { storySettingsPath } from './storyLinks';

type TrayEdge = 'top' | 'bottom';
type TrayTone = 'neutral' | 'warning' | 'destructive';

const EDGE_CLASSES: Record<TrayEdge, string> = {
  top: '-mb-6 rounded-t-[23px] pt-2 pb-8',
  bottom: '-mt-6 rounded-b-[23px] pt-8 pb-2',
};

const TONE_CLASSES: Record<TrayTone, string> = {
  neutral: 'bg-fill-subtle text-muted-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  destructive: 'bg-destructive-subtle text-destructive-subtle-foreground',
};

export function StoryComposerTray({
  edge,
  tone = 'neutral',
  label,
  icon,
  children,
  link,
  actions,
}: {
  edge: TrayEdge;
  tone?: TrayTone;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  link?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('mx-auto flex w-full max-w-3xl items-center gap-3 px-4', EDGE_CLASSES[edge], TONE_CLASSES[tone])}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0">
        {icon}
        <Txt as="span" variant="caption" className="min-w-0 flex-1 basis-60">
          {children}
        </Txt>
        {link}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function StoryFixPill({ fix }: { fix: StoryFix }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return (
    <Button size="sm" variant="primary" render={<Link to={storySettingsPath(factoryId, fix.anchor)} />}>
      {fix.label}
    </Button>
  );
}
