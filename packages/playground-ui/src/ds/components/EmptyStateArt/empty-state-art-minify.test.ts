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

function placement(declarations: string): Matrix | undefined {
  const properties = new Map<string, string>();
  for (const declaration of declarations.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) properties.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
  }
  const placed = ['translate', 'rotate', 'scale', 'transform'].filter(property => properties.has(property));
  if (placed.length === 0 || placed.some(property => properties.get(property)?.includes('var('))) return undefined;
  const read = (property: string) => {
    const value = properties.get(property);
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

const offset = (key: string) => (key === 'from' ? 0 : key === 'to' ? 100 : Number.parseFloat(key));

function placements(css: string) {
  const result = new Map<string, Matrix>();
  for (const keyframes of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    const name = capture(keyframes, 1);
    for (const frame of capture(keyframes, 2).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pose = placement(capture(frame, 2));
      if (!pose) continue;
      for (const key of capture(frame, 1).split(',')) result.set(`${name} ${offset(key.trim())}%`, pose);
    }
  }
  for (const rule of css.matchAll(/([^{}@]*\.fx-[\w-]+[^{}]*)\{([^{}]*)\}/g)) {
    const pose = placement(capture(rule, 2));
    if (pose) result.set(capture(rule, 1).replace(/[\s'"]/g, ''), pose);
  }
  return result;
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
  it('keeps every animated pose through a production Vite build', async () => {
    const expected = placements(readFileSync(stylesheet, 'utf8'));
    const actual = placements(await minified(stylesheet));
    expect(expected.size).toBeGreaterThan(1000);
    const changed = [...expected]
      .filter(([key, pose]) => {
        const built = actual.get(key);
        return !built || differs(built, pose);
      })
      .map(([key]) => key);
    expect(changed).toEqual([]);
  }, 30000);
});
