import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import type { SidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type SidebarNewMeterTone = 'neutral' | 'warning' | 'danger';

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const CARD_HEIGHT = 76;
const BLOOM_HEIGHT = 100;
const BLOOM_HOLD_Y = 60;
const BLOOM_HOLD_X = 22.5;
const GRAIN_OPACITY = 0.18;
const GRAIN_SIZE = 110;

const FALLOFF_RAMP = [0, 0.08, 0.16, 0.25, 0.34, 0.44, 0.55, 0.66, 0.78, 0.89, 1];

const TONES = {
  neutral: { colorVar: '--foreground', peak: 0.08, grain: true, text: 'text-muted-foreground' },
  warning: {
    colorVar: '--notice-warning',
    peak: 0.16,
    grain: false,
    text: 'text-notice-warning-fg',
  },
  danger: {
    colorVar: '--notice-destructive',
    peak: 0.16,
    grain: false,
    text: 'text-notice-destructive-fg',
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

function Bloom({ tone }: { tone: SidebarNewMeterTone }) {
  const current = TONES[tone];
  return (
    <span
      aria-hidden
      data-slot="sidebar-new-meter-bloom"
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

interface SidebarNewMeterBaseProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  label: ReactNode;
  value: ReactNode;
  status?: ReactNode;
  tone?: SidebarNewMeterTone;
  icon?: ReactNode;
  action?: ReactNode;
  LinkComponent?: LinkComponent;
  state?: SidebarState;
}

type SidebarNewMeterLinkProps =
  | {
      href: string;
      linkLabel: string;
    }
  | { href?: never; linkLabel?: never };
export type SidebarNewMeterProps = SidebarNewMeterBaseProps & SidebarNewMeterLinkProps;

export const SidebarNewMeter = forwardRef<HTMLDivElement, SidebarNewMeterProps>(function SidebarNewMeter(
  {
    label,
    value,
    status,
    tone = 'neutral',
    icon,
    action,
    href,
    linkLabel,
    LinkComponent: LinkProp,
    state: stateProp,
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

  if (isCollapsed) {
    return (
      <div
        ref={ref}
        data-slot="sidebar-new-meter"
        data-tone={tone}
        data-state={state}
        className={cn(
          'relative isolate flex items-center justify-center overflow-hidden rounded-lg border border-border bg-background px-1 py-2',
          className,
        )}
        {...props}
      >
        <Bloom tone={tone} />
        {href ? <Link href={href} className="absolute inset-0 rounded-lg" aria-label={linkLabel} /> : null}
        <span className="text-meta text-foreground pointer-events-none relative tabular-nums">{value}</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="sidebar-new-meter"
      data-tone={tone}
      data-state={state}
      className={cn(
        'relative isolate flex flex-col justify-center overflow-hidden rounded-lg border border-border bg-background px-3',
        href && 'transition-colors hover:bg-card',
        className,
      )}
      style={{ height: CARD_HEIGHT }}
      {...props}
    >
      <Bloom tone={tone} />
      {href ? <Link href={href} className="absolute inset-0 rounded-lg" aria-label={linkLabel} /> : null}

      <div className="pointer-events-none relative">
        <div className="flex items-center gap-1.5">
          {tone === 'neutral' ? null : icon}
          <span className="text-column text-muted-foreground">{label}</span>
          {action ? <span className="pointer-events-auto">{action}</span> : null}
        </div>

        <p className="text-heading text-foreground mt-0.5 leading-tight tabular-nums">{value}</p>

        {status ? (
          <div className="text-meta mt-1">
            <p className={cn('truncate', current.text)}>{status}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
});
