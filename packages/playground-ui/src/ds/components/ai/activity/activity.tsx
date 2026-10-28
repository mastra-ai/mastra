import { X } from 'lucide-react';
import { createContext, useContext, useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useArriving } from '@/ds/components/Arrival';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Shimmer } from '@/ds/components/Shimmer';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type ActivityStatus = 'idle' | 'running' | 'error';

/** `row` sits on a hover surface; `inline` reads as text beside prose: no surface, no inset, the line lifts on hover. */
type ActivityAppearance = 'row' | 'inline';

interface ActivityContextValue {
  open: boolean;
  foldable: boolean;
  status: ActivityStatus;
  appearance: ActivityAppearance;
  toggle: () => void;
}

const LIFTS = 'transition-colors motion-reduce:transition-none';
const LIFTS_TO_FOREGROUND = `${LIFTS} group-hover/row:text-foreground group-has-focus-visible/row:text-foreground`;
const LIFTS_TO_MUTED = `${LIFTS} group-hover/row:text-muted-foreground group-has-focus-visible/row:text-muted-foreground`;

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

// Stryker disable next-line ArrowFunction: the default callback is intentionally behaviorless.
const noopOpenChange = () => {};

function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('Activity compounds must be rendered within Activity');
  return context;
}

function useInline() {
  return useContext(ActivityContext)?.appearance === 'inline';
}

export interface ActivityProps extends Omit<
  ComponentProps<typeof Collapsible>,
  'defaultOpen' | 'onOpenChange' | 'open'
> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  foldable?: boolean;
  status?: ActivityStatus;
  appearance?: ActivityAppearance;
}

export function Activity({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange = noopOpenChange,
  foldable = true,
  status = 'idle',
  appearance = 'row',
  className,
  children,
  ...props
}: ActivityProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? (foldable && uncontrolledOpen);
  const statusId = useId();

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange(nextOpen);
  };

  return (
    <ActivityContext.Provider value={{ open, foldable, status, appearance, toggle: () => handleOpenChange(!open) }}>
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
        <span id={statusId} className="sr-only" aria-live="polite">
          {status === 'running' && 'Running'}
          {status === 'error' && 'Failed'}
        </span>
      </Collapsible>
    </ActivityContext.Provider>
  );
}

export const ActivityTrigger = ({ className, children, ...props }: ComponentProps<'div'>) => {
  const { foldable, appearance } = useActivity();
  const lineId = useId();

  return (
    <div
      className={cn(
        'group/row relative w-full min-w-0 rounded-md transition-colors motion-reduce:transition-none',
        foldable && appearance === 'row' && 'hover:bg-fill',
        className,
      )}
      {...props}
    >
      {foldable && (
        <CollapsibleTrigger
          aria-labelledby={lineId}
          className="absolute inset-0 cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-hidden"
        />
      )}
      <div id={lineId} className={cn(foldable && 'pointer-events-none relative')}>
        {children}
      </div>
    </div>
  );
};

export const ActivityHeader = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { status, appearance } = useActivity();

  return (
    <Shimmer
      active={status === 'running'}
      className={cn(
        'flex min-w-0 items-center gap-2 py-1',
        appearance === 'inline' ? 'w-fit max-w-full' : 'w-full px-1.5',
        className,
      )}
      {...props}
    >
      {children}
    </Shimmer>
  );
};

export const ActivityLeading = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { foldable, toggle } = useActivity();

  if (!children) return null;

  return (
    <span
      className={cn('pointer-events-auto flex shrink-0 empty:hidden', foldable && 'cursor-pointer', className)}
      onClick={foldable ? toggle : undefined}
      {...props}
    >
      {children}
    </span>
  );
};

export const ActivityIcon = ({ className, ...props }: ComponentProps<'span'>) => {
  const { status, appearance } = useActivity();

  return (
    <span
      className={cn(
        'flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5 [&_svg]:shrink-0',
        status === 'error' ? 'text-destructive-foreground' : 'text-placeholder',
        status !== 'error' && appearance === 'inline' && LIFTS_TO_MUTED,
        className,
      )}
      {...props}
    />
  );
};

export const ActivityLabel = ({ className, ...props }: ComponentProps<typeof Txt>) => {
  const inline = useInline();

  return (
    <Txt
      as="span"
      variant="caption"
      tone="muted"
      className={cn('shrink-0 truncate', inline ? `max-w-none ${LIFTS_TO_FOREGROUND}` : 'max-w-[55%]', className)}
      {...props}
    />
  );
};

export interface ActivityDetailProps extends Omit<ComponentProps<typeof Txt>, 'font'> {
  font?: 'mono' | 'sans';
  wrap?: boolean;
}

export const ActivityDetail = ({ font = 'mono', wrap = false, className, ...props }: ActivityDetailProps) => {
  const arriving = useArriving();
  const inline = useInline();

  return (
    <Txt
      as="span"
      variant="meta"
      tone="muted"
      font={font === 'mono' ? 'mono' : undefined}
      className={cn('min-w-0', wrap ? 'break-words' : 'truncate', inline && LIFTS_TO_FOREGROUND, arriving, className)}
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

export const ActivitySpacer = ({ rule, className, ...props }: ActivitySpacerProps) => {
  const inline = useInline();

  return (
    <span
      aria-hidden
      className={cn(
        'min-w-2 flex-1',
        rule && 'h-px bg-border mask-r-from-[calc(100%-min(100%,160px))]',
        inline && !rule && 'hidden',
        className,
      )}
      {...props}
    />
  );
};

export const ActivityTrailing = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('flex shrink-0 items-center', className)} {...props} />
);

export const ActivityDisclosure = ({ className, children, ...props }: ComponentProps<'span'>) => {
  const { open, foldable } = useActivity();

  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center', className)} {...props}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center text-muted-foreground/60 transition duration-150 motion-reduce:transition-none',
          'group-hover/row:text-muted-foreground group-has-focus-visible/row:text-muted-foreground',
          open && 'text-muted-foreground',
          open && children != null && 'rotate-90',
          !foldable && 'opacity-0',
        )}
      >
        {children ?? <DisclosureChevron direction="right" open={open} className="size-3.25" />}
      </span>
    </span>
  );
};

export interface ActivityHeadlineProps extends Omit<ComponentProps<typeof ActivityHeader>, 'children'> {
  leading?: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  detail?: string;
  description?: string;
  detailFont?: ActivityDetailProps['font'];
  wrapDetail?: boolean;
  badges?: ReactNode;
}

export const ActivityHeadline = ({
  leading,
  icon,
  label,
  detail,
  description,
  detailFont,
  wrapDetail,
  badges,
  ...props
}: ActivityHeadlineProps) => {
  const { status, appearance } = useActivity();
  const hasBadges = Boolean(badges);
  const labelShrinks = Boolean(description) || (appearance === 'inline' && !detail);

  return (
    <ActivityHeader {...props}>
      <ActivityLeading>{leading}</ActivityLeading>
      <ActivityIcon>{icon}</ActivityIcon>
      <span className={cn('contents', hasBadges && 'flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1')}>
        <ActivityLabel className={cn(labelShrinks && 'max-w-none min-w-0 shrink')}>
          {description || label}
        </ActivityLabel>
        {badges}
        {!description && detail && (
          <ActivityDetail font={detailFont} wrap={wrapDetail} className={cn(hasBadges && 'grow basis-40')}>
            {detail}
          </ActivityDetail>
        )}
      </span>
      <ActivitySpacer className={cn(hasBadges && 'flex-none')} />
      {status === 'error' && (
        <ActivityTrailing>
          <X size={13} role="img" aria-label="Failed" className="shrink-0 text-destructive-foreground" />
        </ActivityTrailing>
      )}
      <ActivityDisclosure />
    </ActivityHeader>
  );
};

export interface ActivityContentProps extends ComponentProps<typeof CollapsibleContent> {
  /** Drop the rail and its indent, so the content lines up with the text around the line. */
  flush?: boolean;
}

export const ActivityContent = ({ flush = false, className, children, ...props }: ActivityContentProps) => {
  const inline = useInline();

  return (
    <CollapsibleContent className="max-w-full min-w-0" {...props}>
      <div
        className={cn(
          'relative flex max-w-full min-w-0 flex-col py-1.5',
          !flush &&
            "gap-1.5 pr-1 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border before:mask-b-from-[calc(100%-min(40%,80px))] before:content-['']",
          !flush && (inline ? 'ml-2' : 'ml-[14px]'),
          className,
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
};

export interface ActivityItemProps extends Omit<ActivityProps, 'children' | 'open' | 'onOpenChange' | 'foldable'> {
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

  return (
    <Activity {...props} foldable={folds} open={collapsible ? undefined : true}>
      <ActivityTrigger>
        <ActivityHeadline
          icon={icon}
          label={label}
          detail={detail}
          detailFont={detailFont}
          wrapDetail={!folds}
          badges={badges}
        />
      </ActivityTrigger>
      {children && <ActivityContent>{children}</ActivityContent>}
    </Activity>
  );
}

export type { ActivityAppearance, ActivityStatus };
