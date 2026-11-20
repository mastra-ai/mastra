import { useEffect, useId, useRef } from 'react';
import { contour, DRAWING_SURFACE_COUNT, factoryPaths, panel } from './onboarding-drawing';
import type { AccountsMode, DrawingScene } from './onboarding-drawing';
import { createOnboardingMotion } from './onboarding-motion';

const FOREGROUND_SURFACES = [0, 1, 2];
const BACKGROUND_SURFACES = Array.from(
  { length: DRAWING_SURFACE_COUNT - FOREGROUND_SURFACES.length },
  (_, index) => FOREGROUND_SURFACES.length + index,
);

/** The SVG stays mounted between steps; only its coordinates and the separate HTML labels change. */
export function OnboardingIllustration({ scene, mode }: { scene: DrawingScene; mode: AccountsMode }) {
  const svg = useRef<SVGSVGElement>(null);
  const id = useId().replace(/\W/g, '');
  const motion = useRef<ReturnType<typeof createOnboardingMotion> | undefined>(undefined);
  useEffect(() => {
    const element = svg.current;
    const stage = element?.parentElement;
    if (!element || !stage) return;
    const drawing = createOnboardingMotion(element, stage);
    motion.current = drawing;
    return () => {
      drawing.destroy();
      motion.current = undefined;
    };
  }, []);
  useEffect(() => {
    motion.current?.set(scene, mode);
  }, [scene, mode]);
  return (
    <svg
      ref={svg}
      viewBox="0 0 400 320"
      aria-hidden="true"
      className="onboarding-sketch onboarding-illustration absolute inset-0 size-full"
      data-scene={scene}
    >
      <defs>
        <clipPath id={`${id}-conveyor`} data-conveyor-clip>
          {factoryPaths.ticketsVisible.map(region => (
            <path key={region} d={region} />
          ))}
        </clipPath>
      </defs>
      <path
        data-landing
        d={`${contour(panel(28, 186, 104, 48).outline)}M76,210h8M80,206v8`}
        className="onboarding-landing"
      />
      <g data-building>
        <path data-foundation d={factoryPaths.foundation} className="onboarding-sketch-surface" />
        <path d={factoryPaths.chimney} className="onboarding-sketch-surface" />
        <path d={factoryPaths.chimneyCap} className="onboarding-sketch-surface" />
        <path d={factoryPaths.recess} className="onboarding-sketch-surface onboarding-recess" />
        <path d={factoryPaths.jambs} />
      </g>
      <g data-building>
        <path d={factoryPaths.wall} className="onboarding-sketch-surface" />
        <path d={factoryPaths.wallMarks} className="onboarding-sketch-detail" />
        <g data-belts>
          <path d={factoryPaths.belts} className="onboarding-sketch-surface" stroke="none" />
          <path d={factoryPaths.beltEdges} />
        </g>
      </g>
      {[0, 1, 2].map(index => (
        <path key={index} data-link className="onboarding-sketch-link" />
      ))}
      {BACKGROUND_SURFACES.map(index => (
        <g key={index} data-surface={index}>
          <path data-face className="onboarding-sketch-surface" />
          <path data-marks className="onboarding-sketch-detail" />
        </g>
      ))}
      {[0, 1, 2].map(index => (
        <circle key={index} data-packet r={3} className="onboarding-sketch-surface" />
      ))}
      {FOREGROUND_SURFACES.map(index => (
        <g key={index} data-surface={index}>
          <path data-face className="onboarding-sketch-surface" />
          <path data-marks className="onboarding-sketch-detail" />
        </g>
      ))}
    </svg>
  );
}
