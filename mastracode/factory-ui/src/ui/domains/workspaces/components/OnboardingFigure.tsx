import { useEffect, useRef } from 'react';
import { HL } from '../figures/hairline-kernel';
import type { FigureDefinition, FigureMode, FigureScene } from '../figures/types';

/** Host the skill's self-contained SVG engine; settings and labels stay in React. */
export function OnboardingFigure({
  figure,
  mode = 'shared',
  label,
  scene = 'factory',
}: {
  figure: FigureDefinition;
  mode?: FigureMode;
  label: string;
  scene?: FigureScene;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<ReturnType<FigureDefinition['mount']> | undefined>(undefined);
  const currentMode = useRef(mode);
  const currentScene = useRef(scene);
  const tour = useRef<ReturnType<typeof HL.tour> | undefined>(undefined);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    let mounted = false;
    let stop = () => {};
    function syncVisibility() {
      if (!element) return;
      const visible = desktop.matches || (element.clientWidth >= 260 && element.clientHeight >= 208);
      if (visible === mounted) return;
      stop();
      mounted = visible;
      if (!visible) return;
      HL.inject(document);
      const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, element);
      const read = {
        get textContent() {
          return element.dataset.readout ?? 'rest';
        },
        set textContent(value: string) {
          element.dataset.readout = value;
        },
      };
      const diagram = element.closest<HTMLElement>('.onboarding-diagram');
      const drawing = figure.mount(
        {
          stage: element,
          svg,
          read,
          // Keep the HTML card crisp and on the same clock as its SVG surface.
          onIntakeFrame: (index, x, y, opacity) => {
            diagram?.style.setProperty(`--intake-${index}-x`, `${x / 4}%`);
            diagram?.style.setProperty(`--intake-${index}-y`, `${y / 3.2}%`);
            diagram?.style.setProperty(`--intake-${index}-opacity`, String(opacity));
          },
        },
        figure.range[1],
      );
      drawing.setMode?.(currentMode.current);
      drawing.setScene?.(currentScene.current, true);
      handle.current = drawing;
      if (!figure.ambient) tour.current = HL.tour(element, figure.tour);
      stop = () => {
        tour.current?.stop();
        tour.current = undefined;
        drawing.destroy();
        svg.remove();
        handle.current = undefined;
        for (const index of [1, 2]) {
          for (const axis of ['x', 'y', 'opacity']) diagram?.style.removeProperty(`--intake-${index}-${axis}`);
        }
      };
    }
    syncVisibility();
    desktop.addEventListener('change', syncVisibility);
    const observer = new ResizeObserver(syncVisibility);
    observer.observe(element);
    return () => {
      desktop.removeEventListener('change', syncVisibility);
      observer.disconnect();
      stop();
    };
  }, [figure]);

  useEffect(() => {
    currentMode.current = mode;
    handle.current?.setMode?.(mode);
  }, [mode]);

  useEffect(() => {
    if (currentScene.current === scene) return;
    currentScene.current = scene;
    handle.current?.setScene?.(scene);
  }, [scene]);

  return (
    <div className="absolute inset-0">
      <div
        ref={stage}
        data-hairline={figure.name}
        data-scene={scene}
        role="img"
        aria-label={label}
        className="onboarding-figure mx-auto h-full max-w-full"
      />
    </div>
  );
}
