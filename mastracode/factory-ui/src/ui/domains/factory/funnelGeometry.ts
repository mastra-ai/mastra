import type { FunnelStage } from './overview';

export const WIDTH = 1100;
/** Height of the band at the baseline — every thickness below is a share of it. */
export const SPAN = 150;
export const AXIS = 12 + SPAN / 2;
export const BOTTOM_MARGIN = 12;
/** A rung holding work never closes to an invisible hairline. */
export const MIN_HALF = 1.25;

const ARM_GAP = 8;
const MIN_ARM = 2.5;
const ARM_RADIUS = 3;

type Point = [number, number];

function curveTo([fromX, fromY]: Point, [x, y]: Point): string {
  const midX = (fromX + x) / 2;
  return `C ${midX} ${fromY} ${midX} ${y} ${x} ${y}`;
}

function ribbon(outer: Point[], inner: Point[]): string {
  const back = [...inner].reverse();
  const head = outer.map((point, index) =>
    index === 0 ? `M ${point[0]} ${point[1]}` : curveTo(outer[index - 1]!, point),
  );
  const tail = back.map((point, index) =>
    index === 0 ? `L ${point[0]} ${point[1]}` : curveTo(back[index - 1]!, point),
  );
  return `${head.join(' ')} ${tail.join(' ')} Z`;
}

function mirror(points: Point[]): Point[] {
  return points.map(([x, y]) => [x, AXIS * 2 - y]);
}

/** One y per column centre, flattened out to both margins. */
function upperEdge(halves: number[]): Point[] {
  const column = WIDTH / halves.length;
  const padded = [halves[0]!, ...halves, halves.at(-1)!];
  const xs = [0, ...halves.map((_, index) => column * (index + 0.5)), WIDTH];
  return xs.map((x, index) => [x, AXIS - padded[index]!]);
}

export function band(halves: number[]): string {
  const edge = upperEdge(halves);
  return ribbon(edge, mirror(edge));
}

/** The lane a stage sheds, peeled off under the flow so the loss keeps its own shape. */
export interface Arm {
  index: number;
  stage: string;
  dropped: number;
  path: string;
}

/** A lane runs only as far as the step the work failed to clear, so where it ends says where the work stopped. */
export function armsOf(flow: number[], funnel: FunnelStage[], unit: number): { arms: Arm[]; depth: number } {
  const column = WIDTH / flow.length;
  const arms: Arm[] = [];
  let depth = 0;

  for (let index = 0; index < flow.length - 1; index++) {
    const dropped = funnel[index]!.reached - funnel[index + 1]!.reached;
    if (dropped === 0) continue;

    const thickness = Math.max(MIN_ARM, dropped * unit);
    const radius = Math.min(ARM_RADIUS, thickness / 2);
    const from = column * (index + 0.5);
    const to = column * (index + 1.5);
    // Born flush against the flow's underside, so it slides out from within the
    // band instead of appearing beside it, and settles clear of what it left.
    const shed = AXIS + flow[index]!;
    const rest = AXIS + flow[index + 1]! + ARM_GAP;

    arms.push({
      index,
      stage: funnel[index]!.stage,
      dropped,
      path: [
        `M ${from} ${shed - thickness}`,
        curveTo([from, shed - thickness], [to - radius, rest]),
        `Q ${to} ${rest} ${to} ${rest + radius}`,
        `L ${to} ${rest + thickness - radius}`,
        `Q ${to} ${rest + thickness} ${to - radius} ${rest + thickness}`,
        curveTo([to - radius, rest + thickness], [from, shed]),
        'Z',
      ].join(' '),
    });
    depth = Math.max(depth, rest + thickness);
  }

  return { arms, depth };
}
