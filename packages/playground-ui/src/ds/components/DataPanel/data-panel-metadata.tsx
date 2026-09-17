import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface DataPanelMetadataProps {
  children: React.ReactNode;
}

/** Row of small `Meta` pills under a `DataPanel.Heading`. */
export function DataPanelMetadata({ children }: DataPanelMetadataProps) {
  return <ul className="text-ui-xs flex min-w-0 flex-wrap items-center gap-0.5 overflow-hidden">{children}</ul>;
}

export interface DataPanelMetaProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  /** Element/component to render as (e.g. a router `Link`). Defaults to `span`. */
  as?: React.ElementType;
  href?: string;
  to?: string;
  /** Prefix icon (bare SVG). */
  icon?: React.ReactNode;
  /** Shown on hover/focus; for a static (non-link) meta a string tooltip also becomes the accessible name. */
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function DataPanelMeta({ as, icon, tooltip, children, className, ...props }: DataPanelMetaProps) {
  const Root = as ?? 'span';
  const isInteractive = Boolean(as || props.href || props.to || props.onClick);

  const hasTooltip = tooltip != null;
  const root = (
    <Root
      aria-label={!isInteractive && typeof tooltip === 'string' ? tooltip : undefined}
      tabIndex={!isInteractive && hasTooltip ? 0 : undefined}
      className={cn(
        // Same recipe as `Crumb`, one size down so the pills sit under the heading.
        'inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full px-[.9em]',
        controlSizeClasses.xs,
        transitions.colors,
        isInteractive
          ? 'cursor-pointer text-neutral4 hover:bg-neutral6/5 hover:text-neutral6 active:bg-neutral6/10'
          : cn('text-neutral3', hasTooltip && 'cursor-help'),
        className,
      )}
      {...props}
    >
      {icon && (
        <Icon size="sm" className={cn('shrink-0 opacity-50 group-hover:opacity-100', transitions.opacity)}>
          {icon}
        </Icon>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </Root>
  );

  return (
    <li className="group h-form-xs flex min-w-0 shrink-0 items-center">
      {!hasTooltip ? (
        root
      ) : (
        <Tooltip>
          <TooltipTrigger render={root} />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}
