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
import { cn } from '../../../lib/utils';

export interface ToolBadgeDisclosureProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  initialCollapsed?: boolean;
  icon?: React.ReactNode;
  collapsible?: boolean;
  detail?: string;
  extraInfo?: React.ReactNode;
  header?: React.ReactNode;
  status?: ToolCallStatus;
  toolCallId?: string;
  isRunning: boolean;
  onToolOpen?: (toolCallId: string) => void;
  'data-testid'?: string;
}

export const ToolBadgeDisclosure = ({
  children,
  initialCollapsed = true,
  icon,
  title,
  detail,
  collapsible = true,
  extraInfo,
  header: headerOverride,
  status = 'idle',
  toolCallId,
  isRunning,
  onToolOpen,
  'data-testid': dataTestId,
}: ToolBadgeDisclosureProps) => {
  const [open, setOpen] = useState(!initialCollapsed);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && toolCallId) onToolOpen?.(toolCallId);
  };
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
      onOpenChange={handleOpenChange}
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
