import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';

export type EntityListTopCellProps = {
  children: ReactNode;
  className?: string;
};

export function EntityListTopCell({ children, className }: EntityListTopCellProps) {
  return (
    <span
      className={cn(
        'h-8 py-1 flex items-center uppercase whitespace-nowrap text-neutral2 tracking-widest text-ui-xs',
        className,
      )}
    >
      {children}
    </span>
  );
}

export type EntityListTopCellWithTooltipProps = {
  children: ReactNode;
  tooltip: string;
  className?: string;
};

export function EntityListTopCellWithTooltip({ children, tooltip, className }: EntityListTopCellWithTooltipProps) {
  return (
    <EntityListTopCell className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex justify-center">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </EntityListTopCell>
  );
}

export type EntityListTopCellSmartProps = {
  label: string;
  icon: ReactNode;
  tooltip?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
};

const breakpointClasses: Record<string, { show: string; hide: string }> = {
  sm: { show: 'hidden sm:inline', hide: 'sm:hidden' },
  md: { show: 'hidden md:inline', hide: 'md:hidden' },
  lg: { show: 'hidden lg:inline', hide: 'lg:hidden' },
  xl: { show: 'hidden xl:inline', hide: 'xl:hidden' },
  '2xl': { show: 'hidden 2xl:inline', hide: '2xl:hidden' },
};

export function EntityListTopCellSmart({
  label,
  icon,
  tooltip,
  breakpoint = '2xl',
  className,
}: EntityListTopCellSmartProps) {
  const bp = breakpointClasses[breakpoint];
  return (
    <EntityListTopCellWithTooltip tooltip={tooltip ?? label} className={className}>
      <span className={bp.show}>{label}</span>
      <span className={bp.hide}>{icon}</span>
    </EntityListTopCellWithTooltip>
  );
}
