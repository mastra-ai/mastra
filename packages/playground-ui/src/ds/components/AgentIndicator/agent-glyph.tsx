import type { LucideIcon, LucideProps } from 'lucide-react';
import { forwardRef, useId } from 'react';

import { frameParts } from './paint';
import type { FrameParts, Stroke } from './paint';
import { poses } from './poses';
import type { AgentIndicatorState } from './poses';
import { once } from './shapes';

const SETTLED_SECONDS = 60;

const drawn = (strokes: Stroke[]) => strokes.filter(stroke => stroke.d);

function glyph(state: AgentIndicatorState): LucideIcon {
  const parts = once((): FrameParts => frameParts(poses[state](0, SETTLED_SECONDS)));

  const Glyph = forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, color = 'currentColor', absoluteStrokeWidth: _, ...props }, ref) => {
      const maskId = `agent-glyph-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
      const { body, balls, cuts, inks, trailCuts, trailInks } = parts();
      const cutting = drawn([...cuts, ...trailCuts]);
      const named = Object.keys(props).some(prop => prop.startsWith('aria-') || prop === 'role' || prop === 'title');

      return (
        <svg
          ref={ref}
          viewBox="-12 -12 24 24"
          width={size}
          height={size}
          fill={color}
          aria-hidden={named ? undefined : true}
          {...props}
        >
          {cutting.length > 0 && (
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-12} y={-12} width={24} height={24}>
              <rect x={-12} y={-12} width={24} height={24} fill="white" />
              <g fill="none" stroke="black" strokeLinecap="round">
                {cutting.map(({ d, width }) => (
                  <path key={d} data-part="cut" d={d} strokeWidth={width} />
                ))}
              </g>
            </mask>
          )}
          <g mask={cutting.length > 0 ? `url(#${maskId})` : undefined}>
            <path data-part="body" d={body} fillRule="evenodd" />
            {balls
              .filter(ball => Number(ball.r) > 0)
              .map(ball => (
                <circle key={`${ball.cx} ${ball.cy}`} data-part="ball" {...ball} />
              ))}
            <g fill="none" stroke={color} strokeLinecap="round">
              {drawn(inks).map(({ d, width }) => (
                <path key={d} data-part="ink" d={d} strokeWidth={width} />
              ))}
            </g>
          </g>
          <g fill="none" stroke={color} strokeLinecap="round">
            {drawn(trailInks).map(({ d, width }) => (
              <path key={d} data-part="ink" d={d} strokeWidth={width} />
            ))}
          </g>
        </svg>
      );
    },
  );
  Glyph.displayName = `AgentGlyph(${state})`;
  return Glyph;
}

const glyphs = new Map<AgentIndicatorState, LucideIcon>();

/** An indicator pose as a still icon: what a row shows for the work the indicator morphs into. */
export function agentGlyph(state: AgentIndicatorState): LucideIcon {
  const known = glyphs.get(state);
  if (known) return known;
  const made = glyph(state);
  glyphs.set(state, made);
  return made;
}
