/**
 * Whether `uri` is an RFC 6570 expansion of `template`, used to resolve
 * `resources/read` against advertised resource templates.
 *
 * The SDK's `UriTemplate.match` compiles to a backtracking regex: with a few
 * adjacent variables (`x://{a}-{b}-{c}-{d}`) a 2 KB client URI takes minutes.
 * This walks the URI once per template segment instead, so the cost stays
 * linear in the URI length. Only membership is decided; variable values are
 * not extracted.
 *
 * Variables with a prefix operator (`{.x}`, `{/x}`, `{#x}`, `{;x}`, `{?x}`,
 * `{&x}`) may be omitted, as an undefined variable expands to nothing. Plain
 * `{x}` and `{+x}` must be non-empty. `{x}` stops at `/`, `?` and `#`, which
 * a real expansion percent-encodes.
 */
export function matchesUriTemplate(template: string, uri: string): boolean {
  return advance(uri, new Set([0]), parse(template)).has(uri.length);
}

type Segment =
  | { kind: 'literal'; text: string }
  | { kind: 'oneOf'; chars: string }
  | { kind: 'run'; excluded: string }
  | { kind: 'optional'; segments: Segment[] };

const literal = (text: string): Segment => ({ kind: 'literal', text });
const run = (excluded: string): Segment => ({ kind: 'run', excluded });
const optional = (...segments: Segment[]): Segment => ({ kind: 'optional', segments });

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
  const specs = body.slice(operator.length).split(',');
  const exploded = specs.some(spec => spec.includes('*'));
  const names = specs.map(spec => spec.replace(/[*]|:\d*$/g, '').trim()).filter(Boolean);
  switch (operator) {
    case '':
      return [run('/?#')];
    case '+':
      return [run('')];
    case '#':
      return [optional(literal('#'), run(''))];
    case '/':
      return exploded ? [optional(literal('/'), run('?#'))] : names.map(() => optional(literal('/'), run('/?#')));
    case '.':
      return names.map(() => optional(literal('.'), run('/?#')));
    case ';':
      return names.map(name => optional(literal(`;${name}`), optional(literal('='), run(';/?#'))));
    default:
      // `?` and `&`: the first pair present opens the query, later ones join it.
      return names.map(name => optional({ kind: 'oneOf', chars: '?&' }, literal(`${name}=`), run('&#')));
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
      // One pass: `inRun` is true while some start offset reaches `i` through allowed characters.
      let start = uri.length;
      for (const p of positions) start = Math.min(start, p);
      let inRun = false;
      for (let i = start; i < uri.length; i++) {
        inRun = (inRun || positions.has(i)) && !segment.excluded.includes(uri[i]!);
        if (inRun) next.add(i + 1);
      }
      return next;
    }
    case 'optional':
      for (const p of positions) next.add(p);
      for (const p of advance(uri, positions, segment.segments)) next.add(p);
      return next;
  }
}
