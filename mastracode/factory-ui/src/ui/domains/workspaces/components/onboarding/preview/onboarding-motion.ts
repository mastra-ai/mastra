import {
  conveyorTicket,
  contour,
  curve,
  drawingPose,
  mix,
  onCurve,
  panel,
  pointBetween,
  segments,
  smooth,
} from './onboarding-drawing';
import type { AccountsMode, DrawingPose, DrawingScene, Point, Surface } from './onboarding-drawing';

type BoardFrame = readonly [time: number, x: number, y: number, opacity: number];
// A second job leaves Build one second after the first arrives. Slots are promoted only once free.
const boardTracks: readonly (readonly BoardFrame[])[] = [
  [
    [0, 28, 186, 1],
    [0.6, 28, 186, 1],
    [1.4, 148, 244, 1],
    [3.5, 148, 244, 1],
    [4.1, 148, 186, 1],
    [5.2, 148, 186, 1],
    [6, 268, 244, 1],
    [7.7, 268, 244, 1],
    [8.3, 268, 186, 1],
    [11.8, 268, 186, 1],
    [12.4, 268, 186, 0],
    [13.2, 28, 186, 0],
    [13.8, 28, 186, 1],
    [14, 28, 186, 1],
  ],
  [
    [0, 148, 186, 1],
    [2.4, 148, 186, 1],
    [3.2, 268, 186, 1],
    [6.8, 268, 186, 1],
    [7.4, 268, 186, 0],
    [9, 28, 186, 0],
    [9.6, 28, 186, 1],
    [10.6, 28, 186, 1],
    [11.4, 148, 186, 1],
    [14, 148, 186, 1],
  ],
];
export function boardFrame(seconds: number, index: number): readonly [number, number, number] {
  const track = boardTracks[index],
    time = seconds % 14;
  const end = track.findIndex(frame => frame[0] > time);
  const a = track[Math.max(0, end - 1)],
    b = track[end < 0 ? track.length - 1 : end];
  const t = smooth((time - a[0]) / (b[0] - a[0] || 1));
  if (a[1] !== b[1] && b[2] > a[2]) {
    const position = onCurve(
      [
        [a[1], a[2]],
        [a[1], b[2]],
        [a[1], b[2]],
        [b[1], b[2]],
      ],
      t,
    );
    return [...position, mix(a[3], b[3], t)];
  }
  return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
}
const interpolatePoints = (from: Point[], to: Point[], t: number) =>
  to.map((point, index) => pointBetween(from[index], point, t));
function interpolateSurface(from: Surface, to: Surface, t: number): Surface {
  return {
    outline: interpolatePoints(from.outline, to.outline, t),
    marks: interpolatePoints(from.marks, to.marks, t),
    opacity: mix(from.opacity ?? 1, to.opacity ?? 1, t),
  };
}
const envelope = (phase: number) => smooth(phase / 0.1) * (1 - smooth((phase - 0.9) / 0.1));
const duration = 760;

/** One clock for geometry and HTML annotations. No React renders or third-party animation runtime per frame. */
export function createOnboardingMotion(svg: SVGSVGElement, stage: HTMLElement) {
  const surfaces = Array.from(svg.querySelectorAll<SVGGElement>('[data-surface]'))
    .toSorted((a, b) => Number(a.dataset.surface) - Number(b.dataset.surface))
    .map(group => ({
      group,
      face: group.querySelector<SVGPathElement>('[data-face]'),
      marks: group.querySelector<SVGPathElement>('[data-marks]'),
    }));
  const links = Array.from(svg.querySelectorAll<SVGPathElement>('[data-link]'));
  const packets = Array.from(svg.querySelectorAll<SVGCircleElement>('[data-packet]'));
  const building = Array.from(svg.querySelectorAll<SVGGElement>('[data-building]'));
  const belts = svg.querySelector<SVGGElement>('[data-belts]');
  const foundation = svg.querySelector<SVGPathElement>('[data-foundation]');
  const landing = svg.querySelector<SVGPathElement>('[data-landing]');
  const conveyorClip = svg.querySelector<SVGClipPathElement>('[data-conveyor-clip]');
  const drawn = new WeakMap<SVGGElement, Surface>();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene: DrawingScene = 'factory',
    mode: AccountsMode = 'shared';
  let current = drawingPose(scene, mode),
    from = current,
    target = current;
  let initialized = false,
    disposed = false,
    intersecting = true;
  let start = 0,
    elapsed = 0,
    lastTime = 0,
    frame = 0,
    morphing = false;

  const attribute = (element: Element | null | undefined, name: string, value: string) => {
    if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  function drawSurface(item: (typeof surfaces)[number], shape: Surface) {
    if (drawn.get(item.group) === shape) return;
    drawn.set(item.group, shape);
    attribute(item.face, 'd', contour(shape.outline));
    attribute(item.marks, 'd', segments(shape.marks));
    const hasArea = shape.outline.some(
      point => Math.hypot(point[0] - shape.outline[0][0], point[1] - shape.outline[0][1]) > 0.05,
    );
    attribute(item.group, 'opacity', String(hasArea ? (shape.opacity ?? 1) : 0));
  }
  function clipToConveyor(group: SVGGElement, clipped: boolean) {
    if (clipped && conveyorClip) attribute(group, 'clip-path', `url(#${conveyorClip.id})`);
    else group.removeAttribute('clip-path');
  }
  function draw(now: number) {
    const settled = media.matches || now - start >= duration + 120;
    const t = media.matches ? 1 : smooth((now - start) / duration);
    const keepBuildingTogether = from.building === 1 && target.building === 1;
    current = settled
      ? { ...target, surfaces: [...target.surfaces] }
      : {
          surfaces: target.surfaces.map((shape, i) =>
            interpolateSurface(
              from.surfaces[i],
              shape,
              keepBuildingTogether || media.matches ? t : smooth((now - start - Math.abs(i - 1) * 24) / duration),
            ),
          ),
          links: target.links.map((link, i) => interpolatePoints(from.links[i], link, t)),
          building: mix(from.building, target.building, t),
          scale: mix(from.scale, target.scale, t),
          x: mix(from.x, target.x, t),
          y: mix(from.y, target.y, t),
          foundation: mix(from.foundation, target.foundation, t),
        };
    const active = initialized && settled;
    morphing = !settled;
    const motion = active && !media.matches;
    building.forEach(group => {
      attribute(group, 'transform', `translate(${current.x} ${current.y}) scale(${current.scale})`);
      attribute(group, 'opacity', String(current.building));
    });
    attribute(belts, 'opacity', String(1 - current.foundation));
    attribute(foundation, 'opacity', String(current.foundation));
    current.links.forEach((points, i) => {
      const visible = points.some(point => Math.hypot(point[0] - points[0][0], point[1] - points[0][1]) > 0.1);
      attribute(links[i], 'd', visible ? curve(points) : '');
    });
    surfaces.forEach((item, i) => {
      const shape = current.surfaces[i];
      const onConveyor = scene === 'factory' && active && (i === 3 || i === 4);
      clipToConveyor(item.group, onConveyor);
      if (onConveyor) {
        const index = i - 3;
        const phase = motion ? (elapsed / 8 + (index === 0 ? 0.18 : 0.53)) % 1 : index === 0 ? 0.18 : 0.82;
        const ticket = { ...conveyorTicket(index, smooth(phase)), opacity: media.matches ? 1 : envelope(phase) };
        current.surfaces[i] = ticket;
        drawSurface(item, ticket);
        return;
      }
      if (scene === 'intake' && active && (i === 1 || i === 2)) {
        const [x, y, alpha] = boardFrame(motion ? elapsed : 0, i - 1);
        const movingShape = { ...panel(x, y, 104, 48), opacity: alpha };
        // Retarget from the actually displayed card if navigation interrupts a job in flight.
        current.surfaces[i] = movingShape;
        drawSurface(item, movingShape);
        stage.style.setProperty(`--intake-${i}-x`, `${(x + 8) / 4}%`);
        stage.style.setProperty(`--intake-${i}-y`, `${(y + 8) / 3.2}%`);
        const labelReveal = media.matches ? 1 : smooth(elapsed / 0.24);
        stage.style.setProperty(`--intake-${i}-opacity`, String(alpha * labelReveal));
        return;
      }
      if (scene === 'intake' && (i === 1 || i === 2)) {
        stage.style.setProperty(`--intake-${i}-opacity`, '0');
      }
      drawSurface(item, shape);
    });
    const empty = [0, 1].every(i => {
      const [x, y, alpha] = boardFrame(motion ? elapsed : 0, i);
      return alpha < 0.01 || x >= 132 || y >= 234;
    });
    attribute(landing, 'opacity', scene === 'intake' && active && empty ? '1' : '0');
    packets.forEach((packet, i) => {
      const shown = motion && scene !== 'factory' && (scene !== 'intake' || i === 0);
      const phase = (elapsed / 4.8 + i / 3) % 1;
      const position = onCurve(current.links[scene === 'codebase' ? 0 : i], smooth(phase));
      attribute(packet, 'cx', String(position[0]));
      attribute(packet, 'cy', String(position[1]));
      attribute(packet, 'opacity', shown ? String(envelope(phase)) : '0');
    });
    attribute(svg, 'data-ready', 'true');
  }
  function visible() {
    return intersecting && !document.hidden && svg.clientWidth > 0 && svg.clientHeight > 0;
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || !visible()) {
      lastTime = 0;
      return;
    }
    if (lastTime && !morphing && !media.matches) elapsed += Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    draw(now);
    if (morphing || !media.matches) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (disposed) return;
    if (!visible()) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      return;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }
  const resize = new ResizeObserver(wake);
  resize.observe(svg);
  const intersection = new IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting ?? false;
    wake();
  });
  intersection.observe(svg);
  const motionChanged = () => {
    start = -duration - 120;
    draw(performance.now());
    wake();
  };
  media.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', wake);
  return {
    set(nextScene: DrawingScene, nextMode: AccountsMode) {
      if (initialized && nextScene === scene && nextMode === mode) return;
      from = current;
      target = drawingPose(nextScene, nextMode);
      scene = nextScene;
      mode = nextMode;
      start = initialized ? performance.now() : -duration - 120;
      elapsed = 0;
      lastTime = 0;
      initialized = true;
      draw(performance.now());
      wake();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      media.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', wake);
      svg.removeAttribute('data-ready');
      for (const i of [1, 2]) {
        for (const axis of ['x', 'y', 'opacity']) stage.style.removeProperty(`--intake-${i}-${axis}`);
      }
    },
  };
}
