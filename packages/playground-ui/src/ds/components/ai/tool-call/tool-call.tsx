import { ChevronRight, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createContext, useContext, useId, useState } from 'react';
import type { ComponentProps } from 'react';
import { useArriving } from '@/ds/components/Arrival';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { CopyButton } from '@/ds/components/CopyButton';
import { Shimmer } from '@/ds/components/Shimmer';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type ToolCallStatus = 'idle' | 'running' | 'error';

interface ToolCallContextValue {
  open: boolean;
  status: ToolCallStatus;
}

const ToolCallContext = createContext<ToolCallContextValue | undefined>(undefined);

// Stryker disable next-line ArrowFunction: the default callback is intentionally behaviorless.
const noopOpenChange = () => {};

function useToolCall() {
  const context = useContext(ToolCallContext);
  if (!context) throw new Error('ToolCall compounds must be rendered within ToolCall');
  return context;
}

export interface ToolCallProps extends Omit<
  ComponentProps<typeof Collapsible>,
  'defaultOpen' | 'onOpenChange' | 'open'
> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  status?: ToolCallStatus;
}

export function ToolCall({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange = noopOpenChange,
  status = 'idle',
  className,
  children,
  ...props
}: ToolCallProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const statusId = useId();

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange(nextOpen);
  };

  return (
    <ToolCallContext.Provider value={{ open, status }}>
      <Collapsible
        open={open}
        onOpenChange={handleOpenChange}
        className={cn('max-w-full min-w-0', className)}
        role="group"
        aria-busy={status === 'running'}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={status === 'idle' ? undefined : statusId}
        data-status={status}
        {...props}
      >
        {children}
        {status !== 'idle' && (
          <span id={statusId} className="sr-only">
            {status === 'running' ? 'Tool call running' : 'Tool call failed'}
          </span>
        )}
      </Collapsible>
    </ToolCallContext.Provider>
  );
}

export const ToolCallTrigger = ({ className, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger
    className={cn(
      'group/row w-full cursor-pointer rounded-md text-left transition-colors hover:bg-neutral6/5 focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
);

export const ToolCallHeader = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { status } = useToolCall();

  return (
    <Shimmer
      active={status === 'running'}
      className={cn('flex w-full min-w-0 items-center gap-2 px-1.5 py-1', className)}
      {...props}
    >
      {children}
    </Shimmer>
  );
};

export const ToolCallIcon = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex size-4 shrink-0 items-center justify-center', className)} {...props} />
);

export const ToolCallLabel = ({ className, ...props }: ComponentProps<typeof Txt>) => (
  <Txt as="span" variant="ui-sm" className={cn('text-icon3 max-w-[55%] shrink-0 truncate', className)} {...props} />
);

export const ToolCallDetail = ({ className, ...props }: ComponentProps<typeof Txt>) => {
  const arriving = useArriving();

  return (
    <Txt
      as="span"
      variant="ui-xs"
      font="mono"
      className={cn('text-icon3 min-w-0 truncate', arriving, className)}
      {...props}
    />
  );
};

export const ToolCallSummary = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex min-w-0 items-center gap-1', className)} {...props} />
);

export interface ToolCallSpacerProps extends ComponentProps<'span'> {
  rule?: boolean;
}

export const ToolCallSpacer = ({ rule, className, ...props }: ToolCallSpacerProps) => (
  <span
    aria-hidden
    className={cn('min-w-2 flex-1', rule && 'h-px bg-border1 mask-r-from-[calc(100%-min(100%,160px))]', className)}
    {...props}
  />
);

export const ToolCallTrailing = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex shrink-0 items-center', className)} {...props} />
);

export const ToolCallDisclosure = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { open } = useToolCall();

  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center', className)} {...props}>
      <span
        aria-hidden
        className={cn(
          'text-icon3 flex shrink-0 items-center opacity-0 transition duration-150 motion-reduce:transition-none',
          'group-hover/row:opacity-100 group-focus-visible/row:opacity-100',
          open && 'rotate-90 opacity-100',
        )}
      >
        {children ?? <ChevronRight size={13} />}
      </span>
    </span>
  );
};

export interface ToolCallPresentedHeaderProps extends Omit<ComponentProps<typeof ToolCallHeader>, 'children'> {
  icon: LucideIcon;
  label: string;
  detail?: string;
  disclosure?: boolean;
}

/** The canonical header of a presented tool call: icon, label, detail, failure mark, chevron. */
export const ToolCallPresentedHeader = ({
  icon: Icon,
  label,
  detail,
  disclosure = true,
  ...props
}: ToolCallPresentedHeaderProps) => {
  const { status } = useToolCall();

  return (
    <ToolCallHeader {...props}>
      <ToolCallIcon>
        <Icon
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={status === 'error' ? 'text-error/80' : 'text-icon2'}
        />
      </ToolCallIcon>
      <ToolCallLabel>{label}</ToolCallLabel>
      {detail && <ToolCallDetail>{detail}</ToolCallDetail>}
      <ToolCallSpacer />
      {status === 'error' && (
        <ToolCallTrailing>
          <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />
        </ToolCallTrailing>
      )}
      {disclosure && <ToolCallDisclosure />}
    </ToolCallHeader>
  );
};

export const ToolCallContent = ({ className, children, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className="max-w-full min-w-0" {...props}>
    <div
      className={cn(
        "relative ml-[14px] flex max-w-full min-w-0 flex-col gap-1.5 py-1.5 pr-1 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border1 before:mask-b-from-[calc(100%-min(40%,80px))] before:content-['']",
        className,
      )}
    >
      {children}
    </div>
  </CollapsibleContent>
);

export interface ToolCallMonoProps extends ComponentProps<'pre'> {
  copyText: string;
}

/** Monospace body block of an expanded call — arguments, command, output — with a hover copy. */
export const ToolCallMono = ({ copyText, className, children, ...props }: ToolCallMonoProps) => (
  <div className="group/block relative max-w-full min-w-0">
    <pre
      className={cn(
        'm-0 max-h-60 max-w-full overflow-auto rounded-md bg-neutral6/5 px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap',
        className,
      )}
      {...props}
    >
      {children}
    </pre>
    <CopyButton
      content={copyText}
      size="sm"
      variant="ghost"
      className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus-visible:opacity-100"
    />
  </div>
);

export type { ToolCallStatus };
