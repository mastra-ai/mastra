import { useId } from 'react';
import type { ComponentProps, SVGProps } from 'react';
import type { BillingArt, BillingArtPaths, BillingArtStroke } from './art/billing-art';
import { creditsArt } from './art/credits-art';
import { largeArt, mediumArt, serverlessArt, smallArt } from './art/project-size-art';
import { cn } from '@/lib/utils';

export type BillingIllustrationName = 'serverless' | 'small' | 'medium' | 'large' | 'credits';

export type BillingIllustrationTone = 'ink' | 'muted' | 'faded';

export type BillingIllustrationProps = Omit<ComponentProps<'svg'>, 'children' | 'viewBox'> & {
  name: BillingIllustrationName;
  tone?: BillingIllustrationTone;
};

export const billingIllustrationHoverGroup = 'group/billing-illustration';

const artByName = {
  serverless: serverlessArt,
  small: smallArt,
  medium: mediumArt,
  large: largeArt,
  credits: creditsArt,
} satisfies Record<BillingIllustrationName, BillingArt>;

const inkByTone = {
  ink: 'fill-foreground',
  muted: 'fill-muted-foreground',
  faded: 'fill-fill-strong',
} satisfies Record<BillingIllustrationTone, string>;

const maskPaintByStroke = {
  solid: { fill: 'black', stroke: 'white', strokeOpacity: 0.7 },
  edge: { stroke: 'white', strokeOpacity: 0.35 },
  line: { stroke: 'white' },
  light: { fill: 'white', stroke: 'white' },
  idle: { fill: 'white', stroke: 'white' },
} satisfies Record<BillingArtStroke, SVGProps<SVGPathElement>>;

const hoverTransition = 'motion-safe:duration-slow motion-safe:ease-out-custom';

const staggerMs = 50;

const classByStroke: Partial<Record<BillingArtStroke, string>> = {
  idle: cn(
    '[fill-opacity:0] [stroke-opacity:0.35]',
    'group-hover/billing-illustration:[fill-opacity:1] group-hover/billing-illustration:[stroke-opacity:1]',
    'group-focus-within/billing-illustration:[fill-opacity:1] group-focus-within/billing-illustration:[stroke-opacity:1]',
    'motion-safe:transition-[fill-opacity,stroke-opacity]',
    hoverTransition,
  ),
};

const dashedClass = cn(
  '[stroke-dasharray:1.5_1.25]',
  'group-focus-within/billing-illustration:[stroke-dasharray:1.5_0] group-hover/billing-illustration:[stroke-dasharray:1.5_0]',
  'motion-safe:transition-[stroke-dasharray]',
  hoverTransition,
);

const liftClass = cn(
  'motion-safe:transition-[translate]',
  'motion-safe:group-focus-within/billing-illustration:[translate:0_-3px] motion-safe:group-hover/billing-illustration:[translate:0_-3px]',
  hoverTransition,
);

const enterClass = cn(
  'opacity-0 group-focus-within/billing-illustration:opacity-100 group-hover/billing-illustration:opacity-100',
  'motion-safe:[translate:0_-8px] motion-safe:group-focus-within/billing-illustration:[translate:0_0] motion-safe:group-hover/billing-illustration:[translate:0_0]',
  'motion-safe:transition-[opacity,translate]',
  hoverTransition,
);

const countIdle = (paths: BillingArtPaths) => paths.filter(([stroke]) => stroke === 'idle').length;

function ArtPaths({ paths, dashed, firstIdle }: { paths: BillingArtPaths; dashed?: boolean; firstIdle: number }) {
  let idle = firstIdle;
  return paths.map(([stroke, d], index) => (
    <path
      key={index}
      d={d}
      {...maskPaintByStroke[stroke]}
      className={cn(classByStroke[stroke], dashed && stroke !== 'light' && dashedClass)}
      style={stroke === 'idle' ? { transitionDelay: `${idle++ * staggerMs}ms` } : undefined}
      vectorEffect="non-scaling-stroke"
    />
  ));
}

export function BillingIllustration({ name, tone = 'ink', className, ...props }: BillingIllustrationProps) {
  const maskId = `billing-illustration-${useId().replace(/[^\w-]/g, '')}`;
  const { viewBox, paths, lifts = [], enters = [], dashed } = artByName[name];
  const parts = [
    ...lifts.map((part, index) => ({ part, className: liftClass, delay: index * staggerMs })),
    ...enters.map(part => ({ part, className: enterClass, delay: 0 })),
  ];
  const [x, y, width, height] = viewBox;

  return (
    <svg
      viewBox={viewBox.join(' ')}
      fill="none"
      aria-hidden="true"
      data-illustration={name}
      className={cn(billingIllustrationHoverGroup, 'block size-30 shrink-0', className)}
      {...props}
    >
      <mask id={maskId}>
        <g strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <ArtPaths paths={paths} dashed={dashed} firstIdle={0} />
          {parts.map(({ part, className, delay }, index) => (
            <g key={index} className={className} style={{ transitionDelay: `${delay}ms` }}>
              <ArtPaths
                paths={part}
                dashed={dashed}
                firstIdle={
                  countIdle(paths) + parts.slice(0, index).reduce((sum, earlier) => sum + countIdle(earlier.part), 0)
                }
              />
            </g>
          ))}
        </g>
      </mask>
      <rect x={x} y={y} width={width} height={height} mask={`url(#${maskId})`} className={inkByTone[tone]} />
    </svg>
  );
}
