import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));
const require = createRequire(resolve(pkgRoot, 'package.json'));
const GATE =
  '@supports (corner-shape: superellipse(2)) and (width: calc(1px * (10px / 5px))) and (not (-moz-orient: inline))';

// How an app with its own Tailwind consumes it: tokens, then the smoothed utilities.
const compileForApp = (candidates: string[]) =>
  compile("@import 'tailwindcss'; @import './theme.css'; @import './smooth-corners.css';", {
    base: pkgRoot,
    loadStylesheet: async (id, base) => {
      const path = id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  }).then(compiler => compiler.build(candidates));

// The body of the first rule for `selector` that opens inside the @supports gate.
const gatedRule = (css: string, selector: string) => {
  const gate = css.indexOf(GATE);
  const start = css.indexOf(`${selector} {`, gate);
  if (gate === -1 || start === -1) return undefined;
  return css.slice(start, css.indexOf('}', start));
};

// What a browser without `corner-shape` sees: everything but the gated blocks.
const withoutGate = (css: string) => {
  let out = css;
  for (let start = out.indexOf(GATE); start !== -1; start = out.indexOf(GATE)) {
    let depth = 0;
    let end = out.indexOf('{', start);
    for (; end < out.length; end++) {
      if (out[end] === '{') depth++;
      else if (out[end] === '}' && --depth === 0) break;
    }
    out = out.slice(0, start) + out.slice(end + 1);
  }
  return out;
};

// `before:rounded-[inherit]` and friends: the declarations Tailwind emits for one class.
const rulesFor = (css: string, className: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector = '']) => selector.includes(className))
    .map(([, , body = '']) => body)
    .join('\n');

describe('smooth corners', () => {
  let css = '';

  beforeAll(async () => {
    css = await compileForApp([
      'rounded-md',
      'rounded-[7px]',
      'rounded-t-xl',
      'rounded-none',
      'rounded-full',
      'rounded-l-full',
      'rounded-r-full',
      'rounded-t-full',
      'rounded-[inherit]',
      'before:rounded-[inherit]',
      'h-5',
      'h-control-md',
      'size-6',
      'w-4',
      'aspect-square',
    ]);
  });

  it('ships as its own raw entry that components.css (and so dist/style.css) imports', () => {
    expect(pkg.exports['./smooth-corners.css']).toBe('./smooth-corners.css');
    expect(pkg.files).toContain('smooth-corners.css');
    expect(readFileSync(resolve(pkgRoot, 'components.css'), 'utf8')).toContain("@import './smooth-corners.css';");
  });

  it('keeps the plain round radius outside the @supports gate, so unsupported browsers are unchanged', () => {
    const ungated = withoutGate(css);
    expect(ungated).toMatch(/\.rounded-md \{\s*border-radius: var\(--radius-md\);\s*\}/);
    expect(ungated).not.toContain('corner-shape: superellipse');
    expect(ungated).not.toContain(':not(._)');
  });

  it('enlarges the radius by the smoothing and sets the matching superellipse, for tokens and arbitrary values', () => {
    const md = gatedRule(css, '.rounded-md:not(._)');
    expect(md).toContain('border-radius: calc(var(--radius-md) * (1 + var(--_cs)))');
    expect(md).toContain('corner-shape: superellipse(log(calc(2 + 2.823 * var(--_cs)');
    // Capped by the element's short side.
    expect(md).toContain('calc(var(--corner-box) / (2 * var(--radius-md)) - 1)');

    expect(gatedRule(css, '.rounded-\\[7px\\]:not(._)')).toContain('border-radius: calc(7px * (1 + var(--_cs)))');

    const top = gatedRule(css, '.rounded-t-xl:not(._)');
    expect(top).toContain('border-top-left-radius: calc(var(--radius-xl) * (1 + var(--_cs-t)))');
    expect(top).toContain('--_shape-t: superellipse(log(calc(2 + 2.823 * var(--_cs-t)');
    expect(top).toContain('corner-top-right-shape: var(--_shape-t)');
    expect(top).not.toContain('bottom');
  });

  it('makes `rounded-full` a capsule that turns into a circle on a square', () => {
    const full = gatedRule(css, '.rounded-full:not(._)') ?? '';
    // The capsule is the radius that wins: nothing after it in the rule sets another one.
    const radii = [...full.matchAll(/border-radius: ([^;]+);/g)].map(([, value = '']) => value);
    expect(radii).toHaveLength(1);
    expect(radii[0]).toContain('/ calc(var(--corner-h) / 2)');
    // Smoothing capped by width / height - 1: 0 on a square, so q = 1 and the shape is round.
    expect(full).toContain('max(var(--corner-w) / var(--corner-h) - 1');
    expect(full).toContain('corner-shape: superellipse(calc(1 + 0.1 * var(--_ps)');
    // One-sided pills take the infinite radius token, which caps their smoothing to 0.
    expect(gatedRule(css, '.rounded-t-full:not(._)')).toContain('border-top-left-radius: calc(var(--corner-end-full)');
  });

  it('gives `rounded-[inherit]` the inherited shape too, pseudo-elements included', () => {
    expect(rulesFor(css, '.rounded-\\[inherit\\]')).toContain('corner-shape: inherit');
    expect(rulesFor(css, '.before\\:rounded-\\[inherit\\]::before')).toContain('corner-shape: inherit');
  });

  it('records the sizes a class fixes', () => {
    expect(rulesFor(css, '.h-5')).toContain('--corner-box: calc(var(--spacing) * 5)');
    expect(rulesFor(css, '.h-control-md')).toContain('--corner-box: var(--spacing-control-md)');
    expect(rulesFor(css, '.size-6')).toContain('--corner-box: calc(var(--spacing) * 6)');
    expect(rulesFor(css, '.size-6')).toContain('--corner-w: calc(var(--spacing) * 6)');
    expect(rulesFor(css, '.w-4')).toContain('--corner-w: calc(var(--spacing) * 4)');
    expect(rulesFor(css, '.aspect-square')).toContain('--corner-w: var(--corner-h)');
  });

  // An inherited radius is the parent's enlarged one: drawn round, it would bulge.
  it('pairs every `border-radius: inherit` in component CSS with `corner-shape: inherit`', () => {
    const files = [
      'components.css',
      ...readdirSync(resolve(pkgRoot, 'src'), { recursive: true, encoding: 'utf8' })
        .filter(path => path.endsWith('.css'))
        .map(path => join('src', path)),
    ];
    const missing = files.flatMap(path =>
      [...readFileSync(resolve(pkgRoot, path), 'utf8').matchAll(/\{([^{}]*border-radius: inherit;[^{}]*)\}/g)]
        .filter(([, body = '']) => !body.includes('corner-shape: inherit'))
        .map(() => path),
    );
    expect(missing).toEqual([]);
  });
});
