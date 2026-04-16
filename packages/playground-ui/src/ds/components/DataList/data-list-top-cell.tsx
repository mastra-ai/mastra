import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export type DataListTopCellProps = {
  children: ReactNode;
  className?: string;
};

export const DataListTopCell = forwardRef<HTMLSpanElement, DataListTopCellProps>(({ children, className }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        'h-8 py-1 flex items-center uppercase whitespace-nowrap text-neutral2 tracking-widest text-ui-xs',
        className,
      )}
    >
      {children}
    </span>
  );
});

export type DataListTopCellWithTooltipProps = {
  children: ReactNode;
  tooltip: string;
  className?: string;
};

export function DataListTopCellWithTooltip({ children, tooltip, className }: DataListTopCellWithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <DataListTopCell className={className}>{children}</DataListTopCell>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export type DataListTopCellSmartProps = {
  long: ReactNode;
  short: ReactNode;
  tooltip?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
};

const breakpointClasses: Record<string, { show: string; hide: string }> = {
  sm: { show: 'hidden sm:inline-flex', hide: 'inline-flex sm:hidden' },
  md: { show: 'hidden md:inline-flex', hide: 'inline-flex md:hidden' },
  lg: { show: 'hidden lg:inline-flex', hide: 'inline-flex lg:hidden' },
  xl: { show: 'hidden xl:inline-flex', hide: 'inline-flex xl:hidden' },
  '2xl': { show: 'hidden 2xl:inline-flex', hide: 'inline-flex 2xl:hidden' },
};

export function DataListTopCellSmart({
  long,
  short,
  tooltip,
  breakpoint = '2xl',
  className,
}: DataListTopCellSmartProps) {
  const tooltipText = tooltip ?? (typeof long === 'string' ? long : undefined);
  const bp = breakpointClasses[breakpoint];

  const content = (
    <>
      <span className={cn('items-center gap-1', bp.show)}>{long}</span>
      <span className={cn('items-center gap-1', bp.hide)}>{short}</span>
    </>
  );

  if (tooltipText) {
    return (
      <DataListTopCellWithTooltip
        tooltip={tooltipText}
        className={cn('flex [&_svg]:w-[1.3em] [&_svg]:h-[1.3em]', className)}
      >
        {content}
      </DataListTopCellWithTooltip>
    );
  }

  return (
    <DataListTopCell className={cn('flex [&_svg]:w-[1.3em] [&_svg]:h-[1.3em]', className)}>{content}</DataListTopCell>
  );
}
