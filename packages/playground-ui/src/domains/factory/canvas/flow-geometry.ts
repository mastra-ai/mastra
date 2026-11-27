/** How round a link turns a corner, when its legs are long enough. */
const CORNER = 8;

export interface Point {
  x: number;
  y: number;
}

/** An SVG path through the turns of a link, each one rounded. */
export function elbowPath(points: readonly Point[]): string {
  const turns = points.filter((point, index) => {
    const before = points[index - 1];
    return !before || before.x !== point.x || before.y !== point.y;
  });
  const span = (from: Point, to: Point) => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const toward = (from: Point, to: Point, by: number) => ({
    x: from.x + Math.sign(to.x - from.x) * by,
    y: from.y + Math.sign(to.y - from.y) * by,
  });
  return turns
    .map((turn, index) => {
      const before = turns[index - 1];
      const after = turns[index + 1];
      if (!before) return `M${turn.x} ${turn.y}`;
      if (!after) return `L${turn.x} ${turn.y}`;
      const round = Math.min(CORNER, span(before, turn) / 2, span(turn, after) / 2);
      const into = toward(turn, before, round);
      const out = toward(turn, after, round);
      return `L${into.x} ${into.y} Q${turn.x} ${turn.y} ${out.x} ${out.y}`;
    })
    .join(' ');
}

/**
 * Where an element sits inside `root`, from layout offsets rather than screen boxes: the canvas zoom doesn't scale
 * them, and a row gliding into place after a drop is already where it will end up.
 */
export function offsetWithin(element: HTMLElement, root: HTMLElement) {
  let top = 0;
  let left = 0;
  for (let node: Element | null = element; node instanceof HTMLElement && node !== root; node = node.offsetParent) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left };
}
