import { useEffect, useState } from 'react';

import { useChatRunning } from '../context/chat-context';
import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrailing,
  ActivityTrigger,
} from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { cn } from '@/lib/utils';

export interface BadgeWrapperProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  initialCollapsed?: boolean;
  icon?: React.ReactNode;
  collapsible?: boolean;
  /** Salient argument shown next to the title: path, command, pattern… */
  detail?: string;
  /** Interactive trailing extras (dialog triggers), kept outside the collapse trigger. */
  extraInfo?: React.ReactNode;
  /** Replaces the assembled icon/title/detail line — the tool path passes its presented headline. */
  header?: React.ReactNode;
  status?: ActivityStatus;
  'data-testid'?: string;
}

export const BadgeWrapper = ({
  children,
  initialCollapsed = true,
  icon,
  title,
  detail,
  collapsible = true,
  extraInfo,
  header: headerOverride,
  status = 'idle',
  'data-testid': dataTestId,
}: BadgeWrapperProps) => {
  const [open, setOpen] = useState(!initialCollapsed);
  const { isRunning } = useChatRunning();
  // A badge already on screen when the thread loaded was not just called.
  const [arrivedLive] = useState(() => isRunning);

  useEffect(() => {
    setOpen(!initialCollapsed);
  }, [initialCollapsed]);

  const header = headerOverride ?? <ActivityHeadline icon={icon} label={title} detail={detail} />;

  const hasBody = Boolean(children);
  const bodyOpen = !collapsible || open;

  return (
    <Activity
      open={bodyOpen}
      foldable={collapsible && hasBody}
      onOpenChange={setOpen}
      status={status}
      className={cn(arrivedLive && 'fade-in-0 slide-in-from-bottom-1 motion-safe:animate-in')}
      data-testid={dataTestId}
    >
      <div className="flex w-full min-w-0 items-center">
        <ActivityTrigger className="min-w-0 flex-1">{header}</ActivityTrigger>
        {extraInfo && <ActivityTrailing className="gap-1 pr-1">{extraInfo}</ActivityTrailing>}
      </div>
      {hasBody && <ActivityContent>{children}</ActivityContent>}
    </Activity>
  );
};
