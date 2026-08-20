import { formatDuration } from '../../../lib/date';

/**
 * Geometry for a cohort ribbon: stops along an axis, thickness the share of the
 * cohort still carried, and whatever a stop held on to peeling off underneath.
 * What the stops mean is the caller's — see `funnel-source.ts`.
 */

/** Under this the stop labels collide, so the axis turns vertical. */
const VERTICAL_BELOW = 700;
/** Drawn before the first measurement, and wherever nothing has a size. */
export const ASSUMED_WIDTH = 900;
/** How far the abandoned branch sinks below the flow it peeled off. */
const LEAK_SPREAD = 9;
/** Clearance either side of a stop, so the flows read as hops rather than one slab. */
const NODE_GAP = 6;
/** Corner softening — the flows are ribbons, not bars. */
const RADIUS = 5;

export interface FunnelStop {
  key: string;
  label: string;
  /** Cards that got at least this far. */
  reached: number;
  /** Hue of the flow leaving this stop, and of the cap on the last one. */
  color: string;
  /** Share of that flow drawn solid, `null` when the window measured none. */
  coreShare?: number | null;
  /** Median time this stop held a card. */
  dwellMs?: number;
  /** What the stop kept, drawn under the branch peeling off. */
  note?: string | null;
  detail: string[];
  /** Tooltip lines for the flow leaving this stop. */
  flowDetail?: string[];
}

export interface FunnelSource {
  stops: FunnelStop[];
  /** Names the solid core of every flow; `null` when the flows have no core. */
  coreLegend: string | null;
  dwellCaption: string | null;
  /** The hop that runs backwards, drawn as an arc over the flows. */
  back: { from: string; to: string; note: string; described: string } | null;
  /** Said in place of a ribbon of zeroes. */
  empty: string;
}

export interface Label {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** A straight run in user space — a gradient axis, or a stop's tie to its flow. */
export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Gate {
  key: string;
  /** Only the last stop is capped: the others are read off the flow that leaves them. */
  cap: { x: number; y: number; width: number; height: number; rx: number; fill: string } | null;
  name: Label;
  count: Label;
  /** Hairline from the label down to the flow, so a column reads as one thing. */
  tie: Line | null;
  anchor: { x: number; y: number };
  detail: string[];
  described: string;
}

export interface Band {
  key: string;
  carried: string;
  /** The share an agent closed, when the source measures one. */
  core: string | null;
  /** The narrowing edge on its own, stroked so the flow keeps a contour. */
  edge: string;
  /** Hues of the stop this flow leaves and the one it enters, and the axis between them. */
  from: string;
  to: string;
  axis: Line;
  anchor: { x: number; y: number };
  dwell: Label | null;
  slowest: boolean;
  detail: string[];
  described: string;
}

export interface Leak {
  key: string;
  path: string;
  note: Label | null;
}

export interface Arc {
  path: string;
  note: Label;
  described: string;
}

export interface FunnelShape {
  width: number;
  height: number;
  gates: Gate[];
  bands: Band[];
  leaks: Leak[];
  /** Names the row of dwell figures, so a bare `1d 4h` is not read as a total. */
  dwellCaption: Label | null;
  coreLegend: string | null;
  arc: Arc | null;
  /** The send-back note, when the vertical layout has no room to draw its arc. */
  sentBack: string | null;
}

/**
 * Cards run along the axis and thickness is the share of the cohort still carried,
 * so a flow narrows into the next stop and whatever it lost peels off underneath.
 */
export function buildFunnel(box: number, source: FunnelSource): FunnelShape {
  const { stops } = source;
  const vertical = box < VERTICAL_BELOW;
  const order = new Map(stops.map((stop, index) => [stop.key, index]));
  const back = source.back;
  const cohort = stops[0]?.reached ?? 0;
  const scale = Math.max(...stops.map(stop => stop.reached), 1);
  const maxThickness = vertical ? Math.min(box * 0.22, 96) : 116;
  const thick = (value: number) => (value / scale) * maxThickness;

  // the arc needs a sky to run through; without one the labels sit down on the flow
  const head = vertical ? 92 : back ? 104 : 74;
  const pad = vertical ? 26 : 24;
  const gap = vertical ? 66 : (box - pad * 2) / Math.max(stops.length - 1, 1);
  const floor = maxThickness + LEAK_SPREAD;
  const alongAt = (index: number) => pad + index * gap;

  const at = (along: number, across: number) =>
    vertical ? { x: head + across, y: along } : { x: along, y: head + across };
  const pt = (along: number, across: number) => {
    const point = at(along, across);
    return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  };
  const ease = (a1: number, c1: number, a2: number, c2: number) =>
    `C ${pt(a1 + (a2 - a1) * 0.45, c1)}, ${pt(a2 - (a2 - a1) * 0.45, c2)}, ${pt(a2, c2)}`;

  const gates = stops.map((stop, index): Gate => {
    const held = thick(stop.reached);
    const along = alongAt(index);
    const anchor = vertical ? 'end' : index === 0 ? 'start' : 'middle';
    const last = index === stops.length - 1;
    return {
      key: stop.key,
      cap: !last
        ? null
        : {
            ...(vertical
              ? { x: head, y: along - 2, width: held, height: 4 }
              : { x: along - 2, y: head, width: 4, height: held }),
            rx: 2,
            fill: stop.color,
          },
      name: {
        text: stop.label,
        ...(vertical ? { x: head - 14, y: along + 1 } : { x: along, y: head - 44 }),
        anchor,
      },
      count: {
        text: String(stop.reached),
        ...(vertical ? { x: head - 14, y: along + 22 } : { x: along, y: head - 18 }),
        anchor,
      },
      tie: vertical ? null : { x1: along, y1: head - 12, x2: along, y2: head + held },
      anchor: at(along, floor),
      detail: stop.detail,
      described: `${stop.label}: ${stop.reached} of ${cohort}${stop.note ? `, ${stop.note}` : ''}`,
    };
  });

  const slowestMs = Math.max(...stops.map(stop => stop.dwellMs ?? 0), 0);
  const dwelt = stops.filter(stop => stop.dwellMs !== undefined).length;

  const leaks = stops.slice(0, -1).flatMap((stop, index): Leak[] => {
    const next = stops[index + 1]!;
    if (stop.reached - next.reached <= 0) return [];
    const a1 = alongAt(index) + NODE_GAP;
    const a2 = alongAt(index + 1) - NODE_GAP;
    const heel = thick(stop.reached);
    const mouth = thick(next.reached);
    return [
      {
        key: stop.key,
        path: `M ${pt(a1, heel)} ${ease(a1, heel, a2, mouth)} L ${pt(a2, heel + LEAK_SPREAD)} ${ease(a2, heel + LEAK_SPREAD, a1, heel)} Z`,
        // one baseline under the flow, so the notes read as a row rather than a staircase
        note: stop.note ? { text: stop.note, ...at(a1 + 4, floor + 14), anchor: 'start' } : null,
      },
    ];
  });

  const labelled = leaks.some(leak => leak.note);
  const dwellRow = floor + (labelled ? 29 : 14);

  const bands = stops.slice(0, -1).map((stop, index): Band => {
    const next = stops[index + 1]!;
    const a1 = alongAt(index) + NODE_GAP;
    const a2 = alongAt(index + 1) - NODE_GAP;
    const heel = thick(stop.reached);
    const mouth = thick(next.reached);
    const ribbon = (share: number) => {
      const start = heel * share;
      const end = mouth * share;
      const r = Math.min(RADIUS, start / 2, end / 2, (a2 - a1) / 2);
      return [
        `M ${pt(a1 + r, 0)} L ${pt(a2 - r, 0)}`,
        `Q ${pt(a2, 0)}, ${pt(a2, r)} L ${pt(a2, end - r)}`,
        `Q ${pt(a2, end)}, ${pt(a2 - r, end)}`,
        ease(a2 - r, end, a1 + r, start),
        `Q ${pt(a1, start)}, ${pt(a1, start - r)} L ${pt(a1, r)}`,
        `Q ${pt(a1, 0)}, ${pt(a1 + r, 0)} Z`,
      ].join(' ');
    };
    const rim = Math.min(RADIUS, heel / 2, mouth / 2, (a2 - a1) / 2);
    const core = stop.coreShare;
    const detail = stop.flowDetail ?? [];
    return {
      key: `${stop.key}-${next.key}`,
      carried: ribbon(1),
      core: core === null || core === undefined || core === 0 ? null : ribbon(core),
      edge: `M ${pt(a1 + rim, heel)} ${ease(a1 + rim, heel, a2 - rim, mouth)}`,
      from: stop.color,
      to: next.color,
      axis: lineBetween(at(a1, 0), at(a2, 0)),
      anchor: at((a1 + a2) / 2, floor),
      dwell:
        stop.dwellMs === undefined
          ? null
          : { text: formatDuration(stop.dwellMs), ...at((a1 + a2) / 2, dwellRow), anchor: 'middle' },
      slowest: stop.dwellMs !== undefined && stop.dwellMs === slowestMs && dwelt > 1,
      detail,
      described: `${stop.label} to ${next.label}: ${detail.join(' · ')}`,
    };
  });

  const backArc = (edge: NonNullable<FunnelSource['back']>): Arc => {
    const from = alongAt(order.get(edge.from)!);
    const to = alongAt(order.get(edge.to)!);
    const base = head - 60;
    const lift = base - 20;
    const bend = (from - to) * 0.35;
    return {
      path: `M ${from.toFixed(1)} ${base} C ${(from - bend).toFixed(1)} ${lift}, ${(to + bend).toFixed(1)} ${lift}, ${(to + 7).toFixed(1)} ${base}`,
      note: { text: edge.note, x: (from + to) / 2, y: lift - 9, anchor: 'middle' },
      described: edge.described,
    };
  };

  const span = alongAt(stops.length - 1);
  const drawn = dwelt > 0 ? dwellRow : labelled ? floor + 14 : floor;

  return {
    width: vertical ? box : span + pad,
    height: vertical ? span + 40 : head + drawn + 10,
    gates,
    bands,
    leaks,
    dwellCaption:
      dwelt > 0 && !vertical && source.dwellCaption
        ? { text: source.dwellCaption, x: 0, y: head + dwellRow, anchor: 'start' }
        : null,
    coreLegend: source.coreLegend,
    arc: back && !vertical ? backArc(back) : null,
    sentBack: back && vertical ? back.note : null,
  };
}

function lineBetween(start: { x: number; y: number }, end: { x: number; y: number }): Line {
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
