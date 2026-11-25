/**
 * Whether `uri` is an RFC 6570 expansion of `template`. Decides membership only,
 * without extracting variables.
 *
 * The SDK's `UriTemplate.match` is a backtracking regex that takes minutes on a
 * few KB of client URI when variables are adjacent (`x://{a}-{b}-{c}-{d}`); this
 * walks the URI once per template segment instead.
 *
 * Plain `{x}` and `{+x}` must be non-empty, since an empty path segment never
 * names a resource. Outside `{+x}` and `{#x}`, values must be percent-encoded:
 * an ASCII reserved character other than `,` ends the value. Raw non-ASCII
 * characters are accepted because clients often send them unencoded.
 */
export function matchesUriTemplate(template: string, uri: string): boolean {
  return advance(uri, new Set([0]), parse(template)).has(uri.length);
}

type Allowed = (char: string) => boolean;

type Segment =
  | { kind: 'literal'; text: string }
  | { kind: 'choice'; options: Segment[][] }
  | { kind: 'run'; allowed: Allowed; min: 0 | 1 }
  | { kind: 'optional'; segments: Segment[] }
  | { kind: 'repeat'; segments: Segment[] };

const encoded: Allowed = char => /[\w\-.~,]/.test(char) || char.charCodeAt(0) > 127;
const anything: Allowed = () => true;

const literal = (text: string): Segment => ({ kind: 'literal', text });
const run = (allowed: Allowed, min: 0 | 1 = 0): Segment => ({ kind: 'run', allowed, min });
const optional = (...segments: Segment[]): Segment => ({ kind: 'optional', segments });
const repeat = (...segments: Segment[]): Segment => ({ kind: 'repeat', segments });
const choice = (options: Segment[][]): Segment => ({ kind: 'choice', options });

function parse(template: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    const close = open === -1 ? -1 : template.indexOf('}', open);
    if (close === -1) {
      segments.push(literal(template.slice(i)));
      break;
    }
    if (open > i) segments.push(literal(template.slice(i, open)));
    segments.push(...expression(template.slice(open + 1, close)));
    i = close + 1;
  }
  return segments;
}

function expression(body: string): Segment[] {
  const operator = '+#./;?&'.includes(body[0] ?? '') ? body[0]! : '';
  const specs = body
    .slice(operator.length)
    .split(',')
    .map(spec => ({ name: spec.replace(/[*]|:\d*$/g, '').trim(), exploded: spec.includes('*') }))
    .filter(spec => spec.name);
  switch (operator) {
    case '':
      return [run(encoded, 1)];
    case '+':
      return [run(anything, 1)];
    case '#':
      return [optional(literal('#'), run(anything))];
    case '/':
      return specs.map(({ exploded }) =>
        exploded ? repeat(literal('/'), run(encoded)) : optional(literal('/'), run(encoded)),
      );
    case '.':
      return specs.map(() => optional(literal('.'), run(encoded)));
    case ';':
      return specs.map(({ name, exploded }) =>
        (exploded ? repeat : optional)(literal(`;${name}`), optional(literal('='), run(encoded))),
      );
    default: {
      // The first pair present starts with the operator (`?` or `&`); every later pair starts with `&`.
      const pair = ({ name, exploded }: (typeof specs)[number], separator: string): Segment[] => {
        const first = [literal(`${separator}${name}=`), run(encoded)];
        return exploded ? [...first, repeat(literal(`&${name}=`), run(encoded))] : first;
      };
      const firstPresent = specs.map((spec, i) => [
        ...pair(spec, operator),
        ...specs.slice(i + 1).map(later => optional(...pair(later, '&'))),
      ]);
      return [optional(choice(firstPresent))];
    }
  }
}

/** Every URI offset reachable after matching `segments` from any offset in `from`. */
function advance(uri: string, from: Set<number>, segments: Segment[]): Set<number> {
  let positions = from;
  for (const segment of segments) {
    if (positions.size === 0) break;
    positions = step(uri, positions, segment);
  }
  return positions;
}

function step(uri: string, positions: Set<number>, segment: Segment): Set<number> {
  const next = new Set<number>();
  switch (segment.kind) {
    case 'literal':
      for (const p of positions) if (uri.startsWith(segment.text, p)) next.add(p + segment.text.length);
      return next;
    case 'choice':
      for (const option of segment.options) for (const p of advance(uri, positions, option)) next.add(p);
      return next;
    case 'run': {
      // A run stops at the first disallowed character, so a start already reached by an earlier run reaches nothing new.
      let end = 0;
      for (const p of [...positions].sort((a, b) => a - b)) {
        const covered = p < end && next.has(p);
        if (segment.min === 0) next.add(p);
        if (covered) continue;
        end = p;
        for (
          let width = charWidth(uri, end, segment.allowed);
          width > 0;
          width = charWidth(uri, end, segment.allowed)
        ) {
          next.add((end += width));
        }
      }
      return next;
    }
    case 'optional':
      for (const p of positions) next.add(p);
      for (const p of advance(uri, positions, segment.segments)) next.add(p);
      return next;
    case 'repeat': {
      for (const p of positions) next.add(p);
      let frontier = positions;
      while (frontier.size > 0) {
        const reached = [...advance(uri, frontier, segment.segments)].filter(p => !next.has(p));
        for (const p of reached) next.add(p);
        frontier = new Set(reached);
      }
      return next;
    }
  }
}

/** Characters a run consumes at `i`: a whole `%HH` triplet, one allowed character, or none. */
function charWidth(uri: string, i: number, allowed: Allowed): number {
  if (i >= uri.length) return 0;
  if (uri[i] === '%') return /^%[0-9A-Fa-f]{2}/.test(uri.slice(i, i + 3)) ? 3 : 0;
  return allowed(uri[i]!) ? 1 : 0;
}
