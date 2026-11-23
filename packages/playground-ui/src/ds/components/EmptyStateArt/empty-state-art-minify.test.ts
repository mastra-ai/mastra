import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

type Matrix = [number, number, number, number, number, number];

const stylesheet = fileURLToPath(new URL('./empty-state-art.css', import.meta.url));
const identity: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = ([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix => [
  a * g + c * h,
  b * g + d * h,
  a * i + c * j,
  b * i + d * j,
  a * k + c * l + e,
  b * k + d * l + f,
];

const numbers = (value: string): [number, ...number[]] => {
  const [first, ...rest] = (value.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
  if (first === undefined) throw new Error(`no numbers in ${value}`);
  return [first, ...rest];
};

const matrixValues = (values: number[]): Matrix => {
  const [a, b, c, d, e, f] = values;
  if (
    values.length !== 6 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    e === undefined ||
    f === undefined
  ) {
    throw new Error(`expected six matrix values, got ${values.join(',')}`);
  }
  return [a, b, c, d, e, f];
};

const capture = (match: RegExpMatchArray, index: number) => {
  const value = match[index];
  if (value === undefined) throw new Error(`missing group ${index} in ${match[0]}`);
  return value;
};

const differs = ([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix) =>
  [a - g, b - h, c - i, d - j, e - k, f - l].some(delta => Math.abs(delta) > 1e-3);

const degrees = (value: string) => {
  const [amount] = numbers(value);
  if (value.includes('turn')) return amount * 360;
  if (value.includes('rad') && !value.includes('grad')) return (amount * 180) / Math.PI;
  return amount;
};

const translation = (x = 0, y = 0): Matrix => [1, 0, 0, 1, x, y];
const rotation = (angle: number): Matrix => {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
};
const scaling = (x = 1, y = x): Matrix => [x, 0, 0, y, 0, 0];

function transformFunction(name: string, args: string): Matrix {
  const values = numbers(args);
  const [a, b] = values;
  const skew = Math.tan((degrees(args) * Math.PI) / 180);
  switch (name) {
    case 'translate':
    case 'translate3d':
      return translation(a, b);
    case 'translateX':
      return translation(a);
    case 'translateY':
      return translation(0, a);
    case 'rotate':
      return rotation(degrees(args));
    case 'scale':
      return scaling(a, b);
    case 'scaleX':
      return scaling(a, 1);
    case 'scaleY':
      return scaling(1, a);
    case 'skewX':
      return [1, 0, skew, 1, 0, 0];
    case 'skewY':
      return [1, skew, 0, 1, 0, 0];
    case 'matrix':
      return matrixValues(values);
    default:
      throw new Error(`unexpected transform function ${name}`);
  }
}

function transformList(value: string): Matrix {
  let result = identity;
  for (const match of value.matchAll(/([a-zA-Z0-9]+)\(([^()]*)\)/g)) {
    result = multiply(result, transformFunction(capture(match, 1), capture(match, 2)));
  }
  return result;
}

type Declarations = Map<string, string>;

const POSE = ['translate', 'rotate', 'scale', 'transform'];
const ANIMATED = /^(animation|transition|opacity|stroke-dashoffset|offset-|transform-origin|transform-box)/;
const ANIMATION_DEFAULTS = {
  duration: '0s',
  'timing-function': 'ease',
  delay: '0s',
  'iteration-count': '1',
  direction: 'normal',
  'fill-mode': 'none',
  'play-state': 'running',
  name: 'none',
} as const;

function normalize(value: string) {
  return value
    .replace(/'/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\)\s+(?=[\w-]+\()/g, ')')
    .trim()
    .replace(/(^|[^\w-])(-?\d*\.?\d+(?:e-?\d+)?)/g, (_, before: string, number: string) => before + Number(number))
    .replace(/(^|[\s(,])-?0(?:px|%|deg)?(?=[\s),!]|$)/g, '$10')
    .replace(/\bsteps\(1(?:,end)?\)|\bstep-end\b/g, 'step-end')
    .replace(/^(-?[\d.e]+)px(!?)$/, '$1$2');
}

function topLevelTokens(value: string) {
  const tokens: string[] = [];
  let depth = 0;
  let token = '';
  for (const character of value) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (character === ',' && depth === 0) throw new Error(`unexpected animation list ${value}`);
    if (character === ' ' && depth === 0) {
      if (token) tokens.push(token);
      token = '';
    } else token += character;
  }
  if (token) tokens.push(token);
  return tokens;
}

function expandAnimation(value: string): Map<string, string> | undefined {
  if (value.includes('var(')) return undefined;
  const fields = new Map<string, string>(Object.entries(ANIMATION_DEFAULTS));
  let times = 0;
  for (const token of topLevelTokens(value)) {
    if (/^-?[\d.]+m?s$/.test(token)) fields.set(times++ === 0 ? 'duration' : 'delay', token);
    else if (token === 'infinite' || /^[\d.]+$/.test(token)) fields.set('iteration-count', token);
    else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(token)) fields.set('direction', token);
    else if (/^(forwards|backwards|both)$/.test(token)) fields.set('fill-mode', token);
    else if (/^(running|paused)$/.test(token)) fields.set('play-state', token);
    else if (
      /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/.test(token)
    )
      fields.set('timing-function', token);
    else fields.set('name', token);
  }
  return fields;
}

function pose(declarations: Declarations): Matrix | undefined {
  const read = (property: string) => {
    const value = declarations.get(property);
    return value === undefined || value === 'none' ? undefined : value;
  };
  const translate = read('translate');
  const rotate = read('rotate');
  const scale = read('scale');
  const transform = read('transform');
  const [x, y] = translate ? numbers(translate) : [0];
  const [sx, sy] = scale ? numbers(scale) : [1];
  return [
    translation(x, y),
    rotate ? rotation(degrees(rotate)) : identity,
    scaling(sx, sy),
    transform ? transformList(transform) : identity,
  ].reduce(multiply);
}

function declarationsOf(body: string, into: Declarations) {
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon <= 0) continue;
    const property = declaration.slice(0, colon).trim();
    const raw = declaration.slice(colon + 1).trim();
    const important = /!\s*important$/.test(raw);
    const value = normalize(raw.replace(/!\s*important$/, '')) + (important ? '!' : '');
    if (property === 'animation') {
      const fields = expandAnimation(value.replace(/!$/, ''));
      if (!fields) into.set(property, value);
      else for (const [field, part] of fields) into.set(`animation-${field}`, part + (important ? '!' : ''));
    } else into.set(property, value);
  }
}

function blocks(css: string, visit: (context: string, prelude: string, body: string) => void) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (start: number, context: string): number => {
    let index = start;
    while (index < text.length) {
      const open = text.indexOf('{', index);
      const close = text.indexOf('}', index);
      if (close !== -1 && (open === -1 || close < open)) return close + 1;
      if (open === -1) return text.length;
      const prelude = text.slice(index, open).trim();
      const nextOpen = text.indexOf('{', open + 1);
      const nextClose = text.indexOf('}', open + 1);
      if (nextClose === -1) throw new Error(`unclosed block after ${prelude}`);
      if (nextOpen === -1 || nextClose < nextOpen) {
        visit(context, prelude, text.slice(open + 1, nextClose));
        index = nextClose + 1;
      } else index = walk(open + 1, `${context}${prelude.replace(/\s+/g, '')}|`);
    }
    return index;
  };
  walk(0, '');
}

const offset = (key: string) => (key === 'from' ? 0 : key === 'to' ? 100 : Number.parseFloat(key));

function animatedValues(css: string) {
  const rules = new Map<string, Declarations>();
  blocks(css, (context, prelude, body) => {
    const keyframes = /@keyframes([\w-]+)\|$/.exec(context);
    const keys = keyframes
      ? prelude.split(',').map(stop => `@keyframes ${capture(keyframes, 1)} ${offset(stop.trim())}%`)
      : [context + prelude.replace(/[\s'"]/g, '')];
    for (const key of keys) {
      const declarations = rules.get(key) ?? new Map<string, string>();
      declarationsOf(body, declarations);
      rules.set(key, declarations);
    }
  });
  const poses = new Map<string, Matrix>();
  const values = new Map<string, string>();
  for (const [key, declarations] of rules) {
    const inKeyframes = key.startsWith('@keyframes ');
    const placed = POSE.filter(property => declarations.has(property));
    const literal = placed.every(property => !declarations.get(property)?.includes('var('));
    if (placed.length > 0 && literal) {
      const matrix = pose(declarations);
      if (matrix) poses.set(key, matrix);
    }
    for (const [property, value] of declarations) {
      if (inKeyframes && property === 'rotate' && literal) {
        values.set(`${key} ${property}`, String(degrees(value)));
      }
      if (POSE.includes(property) && literal) continue;
      if (inKeyframes || POSE.includes(property) || ANIMATED.test(property)) values.set(`${key} ${property}`, value);
    }
  }
  return { poses, values };
}

function changedAnimatedValues(expected: ReturnType<typeof animatedValues>, actual: ReturnType<typeof animatedValues>) {
  const movedPoses = [...expected.poses].filter(([key, pose]) => {
    const built = actual.poses.get(key);
    return !built || differs(built, pose);
  });
  const changedValues = [...expected.values].filter(([key, value]) => actual.values.get(key) !== value);
  return [...movedPoses, ...changedValues].map(([key]) => key);
}

async function minified(path: string) {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'stylesheet-entry',
        resolveId: id => (id === 'stylesheet-entry' ? '\0stylesheet-entry' : null),
        load: id => (id === '\0stylesheet-entry' ? `import ${JSON.stringify(path)};` : null),
      },
    ],
    build: { write: false, rolldownOptions: { input: 'stylesheet-entry' } },
  });
  if (!Array.isArray(output) && !('output' in output)) throw new Error('expected a bundle');
  const asset = [output]
    .flat()
    .flatMap(bundle => bundle.output)
    .find(file => file.type === 'asset' && file.fileName.endsWith('.css'));
  if (!asset || asset.type !== 'asset') throw new Error('no stylesheet emitted');
  return String(asset.source);
}

describe('EmptyStateArt stylesheet', () => {
  it.each(['0deg', '360deg', '-720deg'])('detects a full-turn rotation changed to %s', rotation => {
    const expected = animatedValues('@keyframes spin { to { rotate: -360deg; } }');
    const actual = animatedValues(`@keyframes spin { to { rotate: ${rotation}; } }`);
    expect(changedAnimatedValues(expected, actual)).toContain('@keyframes spin 100% rotate');
  });

  it.each(['-1turn', '-6.283185307179586rad'])('accepts the same full turn expressed as %s', rotation => {
    const expected = animatedValues('@keyframes spin { to { rotate: -360deg; } }');
    const actual = animatedValues(`@keyframes spin { to { rotate: ${rotation}; } }`);
    expect(changedAnimatedValues(expected, actual)).toEqual([]);
  });

  it('keeps every animated value through a production Vite build', async () => {
    const expected = animatedValues(readFileSync(stylesheet, 'utf8'));
    const built = await minified(stylesheet);
    const actual = animatedValues(built);
    expect(expected.poses.size + expected.values.size).toBeGreaterThan(5000);
    expect(changedAnimatedValues(expected, actual)).toEqual([]);
    for (const name of ['lg-sa', 'lg-sb']) {
      const stopped = built.replace(new RegExp(`(@keyframes ${name}\\{[^}]*rotate:)-?[^;}]+`), '$10deg');
      expect(stopped).not.toBe(built);
      expect(changedAnimatedValues(expected, animatedValues(stopped))).toContain(`@keyframes ${name} 100% rotate`);
    }
  }, 30000);
});
