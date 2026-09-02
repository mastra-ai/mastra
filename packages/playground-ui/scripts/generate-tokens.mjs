import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import {
  backgrounds,
  componentColorValues,
  fixedColors,
  gray,
  grayAlpha,
  fontSizes,
  hues,
  legacyAliases,
  letterSpacing,
  lineHeights,
  paperSpacingNames,
  radii,
  semanticColors,
  spacing,
} from './token-registry.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = resolve(packageRoot, 'tokens.css');
const themePath = resolve(packageRoot, 'theme.css');
const tsPath = resolve(packageRoot, 'src/ds/tokens/color-variables.ts');
const bordersPath = resolve(packageRoot, 'src/ds/tokens/borders.ts');
const fontsPath = resolve(packageRoot, 'src/ds/tokens/fonts.ts');
const spacingsPath = resolve(packageRoot, 'src/ds/tokens/spacings.ts');
const check = process.argv.includes('--check');
const prettierConfig = (await resolveConfig(packageRoot)) ?? {};

const toKebab = value =>
  value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`).replace(/([a-z])([0-9])/g, '$1-$2');

const hexToOklch = hex => {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(value => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map(value =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a ** 2 + b ** 2);
  const hue = chroma < 0.0001 ? 0 : (Math.atan2(b, a) * 180) / Math.PI + 360;
  const normalizedHue = hue >= 360 ? hue - 360 : hue;
  return `oklch(${lightness.toFixed(4)} ${chroma < 0.0001 ? '0' : chroma.toFixed(4)} ${normalizedHue.toFixed(2)})`;
};

const cssValue = value => (value.startsWith('#') ? hexToOklch(value) : value);

const foundationEntries = [
  ...Object.entries(fixedColors).map(([name, value]) => [`fixed-${name}`, value]),
  ...Object.entries(componentColorValues),
  ...Object.entries(backgrounds).map(([step, value]) => [`background-${step}`, value]),
  ...Object.entries(gray).map(([step, value]) => [`gray-${step}`, value]),
  ...Object.entries(grayAlpha).map(([step, value]) => [`gray-alpha-${step}`, value]),
  ...Object.entries(hues).flatMap(([hue, scale]) =>
    Object.entries(scale).map(([step, value]) => [`${hue}-${step}`, value]),
  ),
];

const semanticEntries = Object.entries(semanticColors).map(([name, reference]) => [toKebab(name), reference]);
const stateNames = new Set(['color-success', 'color-warning', 'color-error', 'color-info']);
const utilityNames = new Set([
  'surface-primary',
  'surface-secondary',
  'surface-raised',
  'surface-hover',
  'surface-active',
  'surface-contrast',
  'fill-success',
  'fill-warning',
  'fill-error',
  'fill-info',
  'fill-neutral',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
]);

const rootLines = [
  ...foundationEntries.map(([name, pair]) => `  --${name}: ${cssValue(pair.dark)};`),
  ...Object.entries(spacing)
    .filter(([name]) => paperSpacingNames.has(name))
    .map(([name, value]) => `  --space-${name}: ${value};`),
];
const lightLines = foundationEntries.map(([name, pair]) => `  --${name}: ${cssValue(pair.light)};`);
const semanticRootLines = semanticEntries
  .filter(([name]) => !stateNames.has(name))
  .map(([name, reference]) => `  --${name}: var(--${reference});`);
const themeLines = [
  '  --spacing-*: initial;',
  ...Object.entries(spacing).map(([name, value]) => `  --spacing-${name.replace('.', '_')}: ${value};`),
  ...Object.entries(fontSizes).map(([name, value]) => `  --text-${name}: ${value};`),
  ...Object.entries(lineHeights).map(([name, value]) => `  --leading-${name}: ${value};`),
  ...Object.entries(letterSpacing).map(([name, value]) => `  --tracking-${name}: ${value};`),
  ...Object.entries(radii).map(([name, value]) => `  --radius-${name}: ${value};`),
  ...foundationEntries.map(([name]) => `  --color-${name}: var(--${name});`),
  ...semanticEntries.filter(([name]) => utilityNames.has(name)).map(([name]) => `  --color-${name}: var(--${name});`),
  ...semanticEntries
    .filter(([name]) => stateNames.has(name))
    .map(([name, reference]) => `  --${name}: var(--${reference});`),
  '  --color-focus: var(--focus);',
];

const css = await format(
  `:root {\n${rootLines.join('\n')}\n${semanticRootLines.join('\n')}\n  --overlay: rgb(0 0 0 / 75%);\n}\n\nhtml.light {\n${lightLines.join('\n')}\n  --overlay: rgb(0 0 0 / 75%);\n}\n\n@theme inline {\n${themeLines.join('\n')}\n}\n`,
  { ...prettierConfig, parser: 'css' },
);

const foundationTsLines = foundationEntries.map(([name]) => `  '${name}': 'var(--${name})',`);
const semanticTsLines = semanticEntries.map(([name]) => `  '${name}': 'var(--${name})',`);
const legacyTsLines = Object.keys(legacyAliases).map(name => `  '${name}': 'var(--${name})',`);
const ts = await format(
  `export const FoundationColors = {\n${foundationTsLines.join('\n')}\n};\n\nexport const SemanticColors = {\n${semanticTsLines.join('\n')}\n  overlay: 'var(--overlay)',\n};\n\nexport const LegacyColors = {\n${legacyTsLines.join('\n')}\n};\n`,
  { ...prettierConfig, parser: 'typescript' },
);

const verify = async (path, expected) => {
  const actual = await readFile(path, 'utf8').catch(() => '');
  if (actual !== expected) {
    process.stderr.write(`${path} is not generated from scripts/token-registry.mjs\n`);
    process.exitCode = 1;
  }
};

const updateTsExport = (source, exportName, values) => {
  const exportPattern = new RegExp(`export const ${exportName} = \\{[\\s\\S]*?\\n\\}(?: as const)?;`);
  const match = source.match(exportPattern);
  if (!match) throw new Error(`Missing TypeScript export ${exportName}`);
  let block = match[0];
  for (const [name, value] of Object.entries(values)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^\\s*(?:'${escapedName}'|${escapedName}):\\s*)'[^']*'`, 'm');
    if (!pattern.test(block)) throw new Error(`Missing TypeScript token ${exportName}.${name}`);
    block = block.replace(pattern, `$1'${value}'`);
  }
  return source.replace(exportPattern, block);
};

const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const currentTheme = await readFile(themePath, 'utf8');
let theme = currentTheme;
for (const [name, reference] of Object.entries(legacyAliases)) {
  const pattern = new RegExp(`(^\\s*--${escapePattern(name)}:\\s*)[^;]+;`, 'gm');
  theme = theme.replace(pattern, `$1var(--${reference});`);
}
theme = theme.replace(/(^\s*--overlay:\s*)[^;]+;/gm, '$1rgb(0 0 0 / 75%);');
theme = theme.replace(/(^\s*--color-error:\s*)[^;]+;/gm, '$1var(--red-9);');

const bordersSource = await readFile(bordersPath, 'utf8');
const fontsSource = await readFile(fontsPath, 'utf8');
const spacingsSource = await readFile(spacingsPath, 'utf8');
const borders = updateTsExport(bordersSource, 'BorderRadius', radii);
const fonts = updateTsExport(
  updateTsExport(updateTsExport(fontsSource, 'FontSizes', fontSizes), 'LineHeights', lineHeights),
  'LetterSpacings',
  letterSpacing,
);
const spacings = updateTsExport(spacingsSource, 'Spacings', spacing);

if (check) {
  await Promise.all([
    verify(cssPath, css),
    verify(tsPath, ts),
    verify(themePath, theme),
    verify(bordersPath, borders),
    verify(fontsPath, fonts),
    verify(spacingsPath, spacings),
  ]);
} else {
  await Promise.all([
    writeFile(cssPath, css),
    writeFile(tsPath, ts),
    writeFile(themePath, theme),
    writeFile(bordersPath, borders),
    writeFile(fontsPath, fonts),
    writeFile(spacingsPath, spacings),
  ]);
}
