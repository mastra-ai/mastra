import { ChevronRight, X } from 'lucide-react';
import { createContext, useContext, useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useArriving } from '@/ds/components/Arrival';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Shimmer } from '@/ds/components/Shimmer';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type ActivityStatus = 'idle' | 'running' | 'error';

interface ActivityContextValue {
  open: boolean;
  status: ActivityStatus;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

// Stryker disable next-line ArrowFunction: the default callback is intentionally behaviorless.
const noopOpenChange = () => {};

function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('Activity compounds must be rendered within Activity');
  return context;
}

export interface ActivityProps extends Omit<
  ComponentProps<typeof Collapsible>,
  'defaultOpen' | 'onOpenChange' | 'open'
> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  status?: ActivityStatus;
}

export function Activity({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange = noopOpenChange,
  status = 'idle',
  className,
  children,
  ...props
}: ActivityProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const statusId = useId();

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange(nextOpen);
  };

  return (
    <ActivityContext.Provider value={{ open, status }}>
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
            {status === 'running' ? 'Running' : 'Failed'}
          </span>
        )}
      </Collapsible>
    </ActivityContext.Provider>
  );
}

export const ActivityTrigger = ({ className, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger
    className={cn(
      'group/row w-full cursor-pointer rounded-md text-left transition-colors hover:bg-fill focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
);

export const ActivityHeader = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { status } = useActivity();

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

export const ActivityIcon = ({ className, ...props }: ComponentProps<'span'>) => {
  const { status } = useActivity();

  return (
    <span
      className={cn(
        '[&_svg]:stroke-[1.75] flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5 [&_svg]:shrink-0',
        status === 'error' ? 'text-error/80' : 'text-placeholder',
        className,
      )}
      {...props}
    />
  );
};

export const ActivityLabel = ({ className, ...props }: ComponentProps<typeof Txt>) => (
  <Txt as="span" variant="caption" tone="muted" className={cn('max-w-[55%] shrink-0 truncate', className)} {...props} />
);

export interface ActivityDetailProps extends Omit<ComponentProps<typeof Txt>, 'font'> {
  font?: 'mono' | 'sans';
  wrap?: boolean;
}

export const ActivityDetail = ({ font = 'mono', wrap = false, className, ...props }: ActivityDetailProps) => {
  const arriving = useArriving();

  return (
    <Txt
      as="span"
      variant="meta"
      tone="muted"
      font={font === 'mono' ? 'mono' : undefined}
      className={cn('min-w-0', wrap ? 'break-words' : 'truncate', arriving, className)}
      {...props}
    />
  );
};

export const ActivitySummary = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex min-w-0 items-center gap-1', className)} {...props} />
);

export interface ActivitySpacerProps extends ComponentProps<'span'> {
  rule?: boolean;
}

export const ActivitySpacer = ({ rule, className, ...props }: ActivitySpacerProps) => (
  <span
    aria-hidden
    className={cn('min-w-2 flex-1', rule && 'h-px bg-border mask-r-from-[calc(100%-min(100%,160px))]', className)}
    {...props}
  />
);

export const ActivityTrailing = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex shrink-0 items-center', className)} {...props} />
);

export const ActivityDisclosure = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { open } = useActivity();

  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center', className)} {...props}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center text-muted-foreground/60 transition duration-150 motion-reduce:transition-none',
          'group-hover/row:text-muted-foreground group-focus-visible/row:text-muted-foreground',
          open && 'rotate-90 text-muted-foreground',
        )}
      >
        {children ?? <ChevronRight size={13} />}
      </span>
    </span>
  );
};

export interface ActivityHeadlineProps extends Omit<ComponentProps<typeof ActivityHeader>, 'children'> {
  leading?: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  detail?: string;
  detailFont?: ActivityDetailProps['font'];
  wrapDetail?: boolean;
  badges?: ReactNode;
  disclosure?: boolean;
}

export const ActivityHeadline = ({
  leading,
  icon,
  label,
  detail,
  detailFont,
  wrapDetail,
  badges,
  disclosure = true,
  ...props
}: ActivityHeadlineProps) => {
  const { status } = useActivity();

  return (
    <ActivityHeader {...props}>
      {leading}
      <ActivityIcon>{icon}</ActivityIcon>
      <ActivityLabel>{label}</ActivityLabel>
      {badges}
      {detail && (
        <ActivityDetail font={detailFont} wrap={wrapDetail}>
          {detail}
        </ActivityDetail>
      )}
      <ActivitySpacer />
      {status === 'error' && (
        <ActivityTrailing>
          <X size={13} role="img" aria-label="Failed" className="shrink-0 text-error" />
        </ActivityTrailing>
      )}
      {disclosure && <ActivityDisclosure />}
    </ActivityHeader>
  );
};

export const ActivityContent = ({ className, children, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className="max-w-full min-w-0" {...props}>
    <div
      className={cn(
        "relative ml-[14px] flex max-w-full min-w-0 flex-col gap-1.5 py-1.5 pr-1 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border before:mask-b-from-[calc(100%-min(40%,80px))] before:content-['']",
        className,
      )}
    >
      {children}
    </div>
  </CollapsibleContent>
);

export interface ActivityItemProps extends Omit<ActivityProps, 'children' | 'open' | 'onOpenChange'> {
  icon: ReactNode;
  label: string;
  detail?: string;
  detailFont?: ActivityDetailProps['font'];
  badges?: ReactNode;
  collapsible?: boolean;
  children?: ReactNode;
  'aria-label': string;
}

export function ActivityItem({
  icon,
  label,
  detail,
  detailFont,
  badges,
  collapsible = true,
  children,
  ...props
}: ActivityItemProps) {
  const folds = collapsible && Boolean(children);
  const headline = (
    <ActivityHeadline
      icon={icon}
      label={label}
      detail={detail}
      detailFont={detailFont}
      wrapDetail={!folds}
      badges={badges}
      disclosure={folds}
    />
  );

  if (!folds) {
    return (
      <Activity {...props} open>
        {headline}
        {children && <ActivityContent>{children}</ActivityContent>}
      </Activity>
    );
  }

  return (
    <Activity {...props}>
      <ActivityTrigger>{headline}</ActivityTrigger>
      <ActivityContent>{children}</ActivityContent>
    </Activity>
  );
}

export type { ActivityStatus };
