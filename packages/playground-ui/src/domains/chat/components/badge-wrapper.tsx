import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  ToolCall,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallIcon,
  ToolCallLabel,
  ToolCallSpacer,
  ToolCallTrailing,
  ToolCallTrigger,
} from '../../../ds/components/ai/tool-call';
import type { ToolCallStatus } from '../../../ds/components/ai/tool-call';
import { useChatRunning } from '../context/chat-context';
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
  /** Replaces the assembled icon/title/detail header — the tool path passes ToolCallPresentedHeader. */
  header?: React.ReactNode;
  status?: ToolCallStatus;
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

  const header = headerOverride ?? (
    <ToolCallHeader>
      <ToolCallIcon>{icon}</ToolCallIcon>
      <ToolCallLabel>{title}</ToolCallLabel>
      {detail && <ToolCallDetail>{detail}</ToolCallDetail>}
      <ToolCallSpacer />
      {status === 'error' && (
        <ToolCallTrailing>
          <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />
        </ToolCallTrailing>
      )}
      {collapsible && <ToolCallDisclosure />}
    </ToolCallHeader>
  );

  const bodyOpen = !collapsible || open;

  return (
    <ToolCall
      open={bodyOpen}
      onOpenChange={setOpen}
      status={status}
      className={cn(arrivedLive && 'fade-in-0 slide-in-from-bottom-1 motion-safe:animate-in')}
      data-testid={dataTestId}
    >
      <span className="flex w-full min-w-0 items-center">
        {collapsible ? (
          <ToolCallTrigger className="min-w-0 flex-1">{header}</ToolCallTrigger>
        ) : (
          <span className="min-w-0 flex-1">{header}</span>
        )}
        {extraInfo && <ToolCallTrailing className="gap-1 pr-1">{extraInfo}</ToolCallTrailing>}
      </span>
      <ToolCallContent>{children}</ToolCallContent>
    </ToolCall>
  );
};
