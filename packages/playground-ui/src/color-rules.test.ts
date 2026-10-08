import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
export const scannedRoots = ['packages/playground-ui/src', 'packages/playground/src', 'mastracode/factory-ui/src'];
const sourceFile = /\.(css|tsx?)$/;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'dist' ? [] : walk(path);
    return sourceFile.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

const files = scannedRoots
  .flatMap(root => walk(join(repoRoot, root)))
  .map(path => ({
    path: relative(repoRoot, path),
    lines: readFileSync(path, 'utf8')
      .split('\n')
      .filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)),
  }));

const findings = (pattern: RegExp, allowed: (path: string) => boolean) =>
  files
    .filter(file => !allowed(file.path))
    .flatMap(file => file.lines.filter(line => pattern.test(line)).map(line => `${file.path}: ${line.trim()}`));

const chromaticRole =
  '(?:(?:red|orange|amber|green|cyan|blue|purple|pink)-(?:soft-)?\\d+|(?:success|destructive|warning|info)(?:-[a-z]+)*|badge-[a-z]+(?:-[a-z]+)?|product-[a-z-]+|chart-[a-z-]+|span-[a-z]+|brand-[a-z]+(?:-[a-z]+)?)';
const translucentChromatic = new RegExp(
  `\\b(?:bg|text|border(?:-[lrtbxy])?|ring|fill|stroke|outline|shadow|from|via|to|decoration|divide|accent)-${chromaticRole}/\\d+`,
);

// Effects whose job is to reveal what is underneath: animated rings, fades, and glows.
const colorMixEffects = [
  'packages/playground-ui/src/ds/components/Activity/activity.css',
  'packages/playground-ui/src/ds/components/Composer/composer-ring.css',
  'packages/playground-ui/src/ds/components/Composer/composer.css',
  'packages/playground-ui/src/ds/components/GrainFill/grain-fill.css',
  'packages/playground-ui/src/ds/components/Sidebar/footer/sidebar-meter.tsx',
];

// Masks, brand marks, generated palettes, and surfaces that render before the theme loads.
const rawColorExceptions = [
  'packages/playground-ui/src/ds/icons/',
  'packages/playground-ui/src/ds/components/Activity/activity.css',
  'packages/playground-ui/src/ds/components/Composer/composer.css',
  'packages/playground-ui/src/ds/components/ChatShell/chat-shell.tsx',
  'packages/playground-ui/src/ds/components/Sidebar/footer/sidebar-meter.tsx',
  'packages/playground/src/domains/agents/components/agent-channels/platform-icons.tsx',
  'packages/playground/src/startup-error.ts',
  'mastracode/factory-ui/src/ui/ui/icons.tsx',
  'mastracode/factory-ui/src/ui/domains/auth/components/FactoryHalftoneField.tsx',
  'mastracode/factory-ui/src/ui/domains/factory/components/cardMorph.css',
];
const generatedColor = /\b(?:hsla?|rgba?|oklch|oklab)\(\s*\$\{/;
const svgOpacity = /\b(?:fillOpacity|strokeOpacity|fill-opacity|stroke-opacity)\b/;
const rawColor =
  /(?<![\w&-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![\w-])|\b(?:rgba?|hsla?)\(\s*\d|\boklch\(\s*[\d.]/;

describe('color usage', () => {
  it('uses neutral boundary tokens at their authored opacity', () => {
    expect(
      findings(
        /\b(?:border(?:-[lrtbxyse])?|divide|ring|outline)-(?:border(?:-strong|-hover|-focus)?|surface-rim)\//,
        () => false,
      ),
    ).toEqual([]);
  });

  it('keeps chromatic colors opaque: no opacity modifiers on status, badge, product, chart, span, or ramp colors', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(findings(translucentChromatic, () => false)).toEqual([]);
  });

  it('limits color-mix() to the theme and a short list of design-system effects', () => {
    expect(findings(/color-mix\(/, path => colorMixEffects.includes(path))).toEqual([]);
  });

  it('never builds colors at runtime: generated names map to theme hues instead', () => {
    expect(findings(generatedColor, path => path.endsWith('.stories.tsx'))).toEqual([]);
  });

  it('keeps SVG fill and stroke opacity inside design-system components', () => {
    expect(
      findings(svgOpacity, path => path.startsWith('packages/playground-ui/src/ds/') || path.endsWith('.stories.tsx')),
    ).toEqual([]);
  });

  it('keeps literal colors in the theme, outside masks, brand marks, and stories', () => {
    expect(
      findings(
        rawColor,
        path => path.endsWith('.stories.tsx') || rawColorExceptions.some(entry => path.startsWith(entry)),
      ),
    ).toEqual([]);
  });
});
