import { useId, useLayoutEffect, useRef } from 'react';

import { animate } from './animate';
import type { AgentIndicatorState } from './poses';
import { BALLS, LINES, range, TRAIL } from './shapes';
import { cn } from '@/lib/utils';

export interface AgentIndicatorProps {
  state: AgentIndicatorState;
  className?: string;
}

const strokes = (part: string, count: number) => range(count).map(i => <path key={i} data-part={part} />);

export function AgentIndicator({ state, className }: AgentIndicatorProps) {
  const maskId = `agent-indicator-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const animation = useRef<ReturnType<typeof animate>>(null);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const running = animate(svgRef.current);
    animation.current = running;
    return () => {
      running.stop();
      animation.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    animation.current?.show(state);
  }, [state]);

  return (
    <svg
      ref={svgRef}
      viewBox="-12 -12 24 24"
      aria-hidden
      data-state={state}
      className={cn('size-4 shrink-0', className)}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-12} y={-12} width={24} height={24}>
          <rect x={-12} y={-12} width={24} height={24} fill="white" />
          <g fill="none" stroke="black" strokeLinecap="round">
            {strokes('cut', LINES)}
            {strokes('trail-cut', TRAIL - 1)}
          </g>
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <path data-part="body" fillRule="evenodd" />
        {range(BALLS).map(i => (
          <circle key={i} data-part="ball" />
        ))}
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          {strokes('ink', LINES)}
        </g>
      </g>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {strokes('trail-ink', TRAIL - 1)}
      </g>
    </svg>
  );
}
