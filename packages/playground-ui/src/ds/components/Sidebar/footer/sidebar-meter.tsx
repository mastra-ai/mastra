import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { useMaybeSidebarState } from '../root/sidebar-context';
import type { SidebarState } from '../root/sidebar-context';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

import './sidebar-meter.css';

export type SidebarMeterTone = 'neutral' | 'warning' | 'danger';

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const BLOOM_HEIGHT = 100;
const BLOOM_HOLD_Y = 60;
const BLOOM_HOLD_X = 22.5;
const GRAIN_OPACITY = 0.18;
const GRAIN_SIZE = 110;

const FALLOFF_RAMP = [0, 0.08, 0.16, 0.25, 0.34, 0.44, 0.55, 0.66, 0.78, 0.89, 1];

const TONES = {
  neutral: { colorVar: '--foreground', peak: 0.08, grain: true, text: 'text-muted-foreground' },
  warning: {
    colorVar: '--warning-indicator',
    peak: 0.16,
    grain: false,
    text: 'text-warning-foreground',
  },
  danger: {
    colorVar: '--destructive-indicator',
    peak: 0.16,
    grain: false,
    text: 'text-destructive-foreground',
  },
};

function cubicFalloff(position: number) {
  const inverse = 1 - position;
  return inverse * inverse * inverse;
}

function easedBloom(colorVar: string, peak: number) {
  const stops = FALLOFF_RAMP.map(position => {
    const alpha = (peak * cubicFalloff(position) * 100).toFixed(2);
    return `color-mix(in oklch, var(${colorVar}) ${alpha}%, transparent) ${(position * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function easedMask(direction: string, hold: number) {
  const stops = FALLOFF_RAMP.map(position => {
    const offset = (hold + (100 - hold) * position).toFixed(2);
    return `rgb(0 0 0 / ${cubicFalloff(position).toFixed(3)}) ${offset}%`;
  });
  return `linear-gradient(${direction}, rgb(0 0 0 / 1) 0%, ${stops.join(', ')})`;
}

const BLOOM_MASK = `${easedMask('to bottom', BLOOM_HOLD_Y)}, ${easedMask('to right', BLOOM_HOLD_X)}`;

function Bloom({ tone }: { tone: SidebarMeterTone }) {
  const current = TONES[tone];
  return (
    <span
      aria-hidden
      data-slot="sidebar-meter-bloom"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10"
      style={{
        height: BLOOM_HEIGHT,
        backgroundImage: easedBloom(current.colorVar, current.peak),
        maskImage: BLOOM_MASK,
        maskComposite: 'intersect',
      }}
    >
      {current.grain ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: NOISE,
            backgroundRepeat: 'repeat',
            backgroundSize: `${GRAIN_SIZE}px ${GRAIN_SIZE}px`,
            opacity: GRAIN_OPACITY,
          }}
        />
      ) : null}
    </span>
  );
}

// Each line is cropped to its letters (cap height to baseline), so the card's padding is the space you see above
// the first line and below the last.
const trimToLetters = '[text-box:trim-both_cap_alphabetic]';

/** A placeholder for one line: the line keeps the real text's height and the bar sits centred on it, so the card is
 * the same size loading and loaded. Unlike `SkeletonText`, the bar is out of flow: a cropped line is shorter than its
 * bar and would grow to fit it. */
function MeterLineSkeleton({ line, bar }: { line: string; bar: string }) {
  return (
    <span data-meter-skeleton="" className={cn('relative block', trimToLetters, line)}>
      <span aria-hidden>{'\u200b'}</span>
      <Skeleton className={cn('absolute top-1/2 left-0 -translate-y-1/2', bar)} />
    </span>
  );
}

interface SidebarMeterBaseProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  label: ReactNode;
  value: ReactNode;
  /** A shorter amount for the rail, where the card is 40px wide (`$7K` for `$6,649.10`). Defaults to `value`. */
  railValue?: ReactNode;
  status?: ReactNode;
  tone?: SidebarMeterTone;
  icon?: ReactNode;
  action?: ReactNode;
  LinkComponent?: LinkComponent;
  state?: SidebarState;
  /** Renders the card at its loaded size, with a placeholder for each line. */
  loading?: boolean;
}

type SidebarMeterLinkProps =
  | {
      href: string;
      linkLabel: string;
    }
  | { href?: never; linkLabel?: never };
export type SidebarMeterProps = SidebarMeterBaseProps & SidebarMeterLinkProps;

/**
 * One card in both states. In the rail the label and status lines fold away and the amount, the same element
 * throughout, shrinks in place: the sidebar's collapse animates between the two (`sidebar-meter.css`).
 */
export const SidebarMeter = forwardRef<HTMLDivElement, SidebarMeterProps>(function SidebarMeter(
  {
    label,
    value,
    railValue,
    status,
    tone = 'neutral',
    icon,
    action,
    href,
    linkLabel,
    LinkComponent: LinkProp,
    state: stateProp,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const ctx = useMaybeSidebarState();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const Link: LinkComponent = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isCollapsed = state === 'collapsed';
  const current = TONES[tone];

  return (
    <div
      ref={ref}
      data-slot="sidebar-meter"
      data-tone={tone}
      data-state={state}
      aria-busy={loading || undefined}
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-lg border border-border bg-background px-2.25 py-2.5',
        href && surfaceStateLayerStyle,
        className,
      )}
      {...props}
    >
      <Bloom tone={tone} />
      {href && !loading ? (
        <Link
          href={href}
          // The card clips its contents for the bloom, so the focus outline is drawn inside, over its border.
          className="absolute inset-0 rounded-lg focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-focus"
          aria-label={linkLabel}
        />
      ) : null}
      <div className="pointer-events-none relative flex h-full flex-col justify-center">
        {/* Folded away in the rail: out of the accessibility tree and out of keyboard reach. */}
        <div data-meter-fold="" inert={isCollapsed}>
          {loading ? (
            <MeterLineSkeleton line="text-column" bar="h-2.5 w-14" />
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              {tone === 'neutral' ? null : icon}
              <Txt as="span" variant="column" tone="muted" className={trimToLetters}>
                {label}
              </Txt>
              {/* Zero-height, so the action doesn't make the line taller than its letters; it overflows, centred. */}
              {action ? <span className="pointer-events-auto inline-flex h-0 items-center">{action}</span> : null}
            </div>
          )}
        </div>
        <div data-meter-value="" data-meter-swap={railValue === undefined ? undefined : ''} className="mt-2.5">
          {loading ? (
            <MeterLineSkeleton line="text-heading" bar="h-3 w-12" />
          ) : (
            <Txt variant="heading" tone="ink" className={cn('tabular-nums', trimToLetters)}>
              {railValue === undefined ? (
                value
              ) : (
                <>
                  <span data-meter-full="" aria-hidden={isCollapsed || undefined}>
                    {value}
                  </span>
                  <span data-meter-rail="" aria-hidden={!isCollapsed || undefined}>
                    {railValue}
                  </span>
                </>
              )}
            </Txt>
          )}
        </div>
        {status ? (
          <div data-meter-fold="" data-meter-status="" className="mt-2.5" inert={isCollapsed}>
            {loading ? (
              <MeterLineSkeleton line="text-meta" bar="h-2 w-24" />
            ) : (
              // Descenders hang below the crop, so a status that truncates clips only sideways.
              <p
                className={cn(
                  'min-w-0 overflow-x-clip text-meta text-ellipsis whitespace-nowrap',
                  trimToLetters,
                  current.text,
                )}
              >
                {status}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});
