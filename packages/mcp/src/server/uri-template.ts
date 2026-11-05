/**
 * Whether `uri` is an RFC 6570 expansion of `template`. Decides membership only,
 * without extracting variables.
 *
 * The SDK's `UriTemplate.match` is a backtracking regex that takes minutes on a
 * few KB of client URI when variables are adjacent (`x://{a}-{b}-{c}-{d}`); this
 * walks the URI once per template segment instead.
 *
 * Plain `{x}` and `{+x}` must be non-empty, since an empty path segment never
 * names a resource; `{x}` stops at `/`, `?` and `#`, which an expansion encodes.
 */
export function matchesUriTemplate(template: string, uri: string): boolean {
  return advance(uri, new Set([0]), parse(template)).has(uri.length);
}

type Segment =
  | { kind: 'literal'; text: string }
  | { kind: 'oneOf'; chars: string }
  | { kind: 'run'; excluded: string; min: 0 | 1 }
  | { kind: 'optional'; segments: Segment[] }
  | { kind: 'repeat'; segments: Segment[] };

const literal = (text: string): Segment => ({ kind: 'literal', text });
const run = (excluded: string, min: 0 | 1 = 0): Segment => ({ kind: 'run', excluded, min });
const optional = (...segments: Segment[]): Segment => ({ kind: 'optional', segments });
const repeat = (...segments: Segment[]): Segment => ({ kind: 'repeat', segments });

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
      return [run('/?#', 1)];
    case '+':
      return [run('', 1)];
    case '#':
      return [optional(literal('#'), run(''))];
    case '/':
      return specs.map(({ exploded }) =>
        exploded ? repeat(literal('/'), run('/?#')) : optional(literal('/'), run('/?#')),
      );
    case '.':
      return specs.map(() => optional(literal('.'), run('/?#')));
    case ';':
      return specs.map(({ name }) => optional(literal(`;${name}`), optional(literal('='), run(';/?#'))));
    default: {
      // `?` and `&`: the first pair present opens the query, later ones join it.
      const pair = (name: string) => [{ kind: 'oneOf', chars: '?&' } as const, literal(`${name}=`), run('&#')];
      return specs.map(({ name, exploded }) => (exploded ? repeat(...pair(name)) : optional(...pair(name))));
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
    case 'oneOf':
      for (const p of positions) if (p < uri.length && segment.chars.includes(uri[p]!)) next.add(p + 1);
      return next;
    case 'run': {
      // A run stops at the first excluded character, so a start inside an earlier run reaches nothing new.
      let end = 0;
      for (const p of [...positions].sort((a, b) => a - b)) {
        if (segment.min === 0) next.add(p);
        if (p < end) continue;
        end = p;
        while (end < uri.length && !segment.excluded.includes(uri[end]!)) next.add(++end);
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
