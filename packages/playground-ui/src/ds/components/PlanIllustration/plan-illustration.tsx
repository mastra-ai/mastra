import { useId } from 'react';
import type { ComponentProps, SVGProps } from 'react';
import { enterpriseArt } from './art/enterprise-art';
import { freeArt } from './art/free-art';
import type { PlanArt, PlanArtStroke } from './art/plan-art';
import { starterArt } from './art/starter-art';
import { teamsArt } from './art/teams-art';
import { cn } from '@/lib/utils';

export type PlanIllustrationPlan = 'free' | 'starter' | 'teams' | 'enterprise';

export type PlanIllustrationTone = 'faded' | 'muted';

export type PlanIllustrationProps = Omit<ComponentProps<'svg'>, 'children' | 'viewBox'> & {
  plan: PlanIllustrationPlan;
  tone?: PlanIllustrationTone;
};

const artByPlan = {
  free: freeArt,
  starter: starterArt,
  teams: teamsArt,
  enterprise: enterpriseArt,
} satisfies Record<PlanIllustrationPlan, PlanArt>;

const inkByTone = {
  faded: 'fill-fill-strong',
  muted: 'fill-muted-foreground',
} satisfies Record<PlanIllustrationTone, string>;

const maskPaintByStroke = {
  solid: { fill: 'black', stroke: 'white', strokeOpacity: 0.7 },
  edge: { stroke: 'white', strokeOpacity: 0.35 },
  line: { stroke: 'white' },
  light: { fill: 'white', stroke: 'white' },
  lamp: {
    fill: 'white',
    className:
      'opacity-0 transition-opacity duration-slow ease-out-custom motion-reduce:transition-none group-hover/plan-card:opacity-100 group-focus-within/plan-card:opacity-100',
  },
} satisfies Record<PlanArtStroke, SVGProps<SVGPathElement>>;

const lampStaggerMs = 60;

export function PlanIllustration({ plan, tone = 'faded', className, ...props }: PlanIllustrationProps) {
  const maskId = `plan-illustration-${useId().replace(/[^\w-]/g, '')}`;
  const { viewBox, paths } = artByPlan[plan];
  const [x, y, width, height] = viewBox;
  let lampsLit = 0;

  return (
    <svg
      viewBox={viewBox.join(' ')}
      fill="none"
      aria-hidden="true"
      data-plan={plan}
      className={cn('block size-28 shrink-0 mask-b-from-50% mask-l-from-50%', className)}
      {...props}
    >
      <mask id={maskId}>
        <g strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          {paths.map(([stroke, d], index) => (
            <path
              key={index}
              d={d}
              {...maskPaintByStroke[stroke]}
              style={stroke === 'lamp' ? { transitionDelay: `${lampsLit++ * lampStaggerMs}ms` } : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </mask>
      <rect x={x} y={y} width={width} height={height} mask={`url(#${maskId})`} className={inkByTone[tone]} />
    </svg>
  );
}
