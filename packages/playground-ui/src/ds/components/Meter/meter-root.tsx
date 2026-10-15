import { useId } from 'react';
import type { CSSProperties, ComponentProps, ReactNode } from 'react';
import { MeterPartContext, sourceColorClassName } from './meter-context';
import { MeterKeyRow } from './meter-key-row';
import { MeterSegment } from './meter-segment';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip/tooltip';
import { focusRing, transitions } from '@/ds/primitives/transitions';
import { formatFullNumber } from '@/lib/cost';
import { cn } from '@/lib/utils';

export type MeterProps = Omit<ComponentProps<'span'>, 'children'> & {
  value: number;
  max: number;
  children?: ReactNode;
  format?: (value: number) => string;
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string });

type Reading = { used: number; allowance: number; over: number; within: number; rest: number };

function readingOf(value: number, max: number): Reading {
  const used = Math.max(0, value);
  const allowance = Math.max(0, max);
  const over = Math.max(0, used - allowance);
  const within = used - over;
  return { used, allowance, over, within, rest: allowance - within };
}

function overAllowanceText({ used, allowance, over }: Reading, format: (value: number) => string) {
  if (over <= 0) return undefined;
  return `${format(used)} of ${format(allowance)}, ${format(over)} over`;
}

export function MeterRoot({ value, max, children, format = formatFullNumber, className, ...props }: MeterProps) {
  const reading = readingOf(value, max);
  const meterProps = {
    role: 'meter',
    'aria-valuemin': 0,
    'aria-valuemax': reading.allowance,
    'aria-valuenow': reading.within,
    'aria-valuetext': overAllowanceText(reading, format),
    'data-over': reading.over > 0 || undefined,
    className: cn('group/meter relative flex h-1 w-full min-w-0', className),
    ...props,
  };

  if (children === undefined) {
    return (
      <span {...meterProps}>
        <AllowanceBar reading={reading} />
      </span>
    );
  }

  return (
    <SourcesMeter reading={reading} format={format} meterProps={meterProps}>
      {children}
    </SourcesMeter>
  );
}

function SourcesMeter({
  reading,
  format,
  meterProps,
  children,
}: {
  reading: Reading;
  format: (value: number) => string;
  meterProps: ComponentProps<'span'>;
  children: ReactNode;
}) {
  const keyId = useId();
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <span
            {...meterProps}
            tabIndex={0}
            aria-describedby={keyId}
            className={cn(
              meterProps.className,
              'rounded-full before:absolute before:inset-x-0 before:-inset-y-2',
              focusRing,
            )}
          />
        }
      >
        <AllowanceBar reading={reading} className={cn(fadeOut, transitions.opacity, 'motion-reduce:transition-none')} />
        <SourceBar reading={reading} format={format}>
          {children}
        </SourceBar>
      </TooltipTrigger>
      <TooltipContent keepMounted id={keyId}>
        <MeterKey reading={reading} format={format}>
          {children}
        </MeterKey>
      </TooltipContent>
    </Tooltip>
  );
}

const fadeOut = 'group-hover/meter:opacity-0 group-focus-visible/meter:opacity-0';
const fadeIn = 'opacity-0 group-hover/meter:opacity-100 group-focus-visible/meter:opacity-100';

function AllowanceBar({ reading, className }: { reading: Reading; className?: string }) {
  const { used, over, within, rest } = reading;
  return (
    <span data-slot="meter-bar" className={cn('flex size-full gap-0.5', className)}>
      {within > 0 && <MeterSegment slot="meter-used" grow={within} className="bg-foreground" />}
      {over > 0 && <MeterSegment slot="meter-over" grow={over} className="bg-destructive-indicator" />}
      {(rest > 0 || used === 0) && <MeterSegment slot="meter-rest" grow={rest || 1} className="bg-fill-strong" />}
    </span>
  );
}

interface OverStyle extends CSSProperties {
  '--meter-over': string;
}

function SourceBar({
  reading,
  format,
  children,
}: {
  reading: Reading;
  format: (value: number) => string;
  children: ReactNode;
}) {
  const { used, over, rest } = reading;
  const overShare = used > 0 ? over / used : 0;
  const overStyle: OverStyle = { '--meter-over': `${overShare * 100}%` };
  return (
    <span
      aria-hidden
      data-slot="meter-sources"
      style={overStyle}
      className={cn(
        'absolute inset-0 flex gap-0.5',
        fadeIn,
        transitions.opacity,
        'motion-reduce:transition-none',
        sourceColorClassName,
      )}
    >
      <MeterPartContext value={{ part: 'bar', format }}>{children}</MeterPartContext>
      {rest > 0 && <MeterSegment slot="meter-rest" grow={rest} className="bg-fill-strong" />}
      {over > 0 && (
        <>
          <span className="absolute inset-y-0 right-0 w-(--meter-over) rounded-r-full bg-destructive-indicator" />
          <span className="absolute -inset-y-1 right-(--meter-over) w-0.5 rounded-full bg-foreground" />
        </>
      )}
    </span>
  );
}

function MeterKey({
  reading,
  format,
  children,
}: {
  reading: Reading;
  format: (value: number) => string;
  children: ReactNode;
}) {
  const { over, rest } = reading;
  return (
    <div data-slot="meter-key" className={cn('flex min-w-40 flex-col gap-1', sourceColorClassName)}>
      <MeterPartContext value={{ part: 'key', format }}>{children}</MeterPartContext>
      {rest > 0 && <MeterKeyRow swatch="bg-fill-strong" label="Remaining" amount={format(rest)} />}
      {over > 0 && <MeterKeyRow swatch="bg-destructive-indicator" label="Over allowance" amount={format(over)} />}
    </div>
  );
}
