import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(packageRoot, 'src');
const sourceExtensions = new Set(['.css', '.ts', '.tsx']);
const excludedSegments = ['/__tests__/', '/ds/icons/', '/ds/tokens/'];
const excludedNames = ['.stories.', '.test.'];
const dynamicColorFiles = new Set(['lib/colors.ts', 'ds/components/SankeyChart/sankeyColor.ts']);
const legacyName =
  '(?:surface[1-6]|neutral[1-6]|border[12]|accent(?:1|2|3|5|6)(?:Dark|Darker)?|positive1|negative1|warning1)';
const legacyClassPattern = new RegExp(
  `(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide)-${legacyName}\\b`,
);
const legacyVariablePattern = new RegExp(`var\\(--${legacyName}\\)`);
const defaultPalettePattern =
  /(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide)-(?:white|black|slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|[1-9]00|950))?(?:\/[\d[\].]+)?(?![\w-])/;
const colorLiteralPattern = /#[\da-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i;
const shadowOrMaskPattern = /(?:box-?shadow|shadow|mask-image)/i;

const walk = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
};

const failures = [];
for (const path of await walk(sourceRoot)) {
  if (!sourceExtensions.has(extname(path))) continue;
  const sourcePath = relative(sourceRoot, path).replaceAll('\\', '/');
  const normalizedPath = `/${sourcePath}`;
  if (excludedSegments.some(segment => normalizedPath.includes(segment))) continue;
  if (excludedNames.some(name => sourcePath.includes(name))) continue;
  if (dynamicColorFiles.has(sourcePath)) continue;

  const source = (await readFile(path, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  let insideShadowValue = false;
  for (const [index, line] of source.split('\n').entries()) {
    const code = line.replace(/\/\/.*$/, '');
    if (/--[\w-]*shadow\s*:|box-shadow\s*:/i.test(code)) insideShadowValue = true;
    const hasLegacyColor = legacyClassPattern.test(code) || legacyVariablePattern.test(code);
    const hasDefaultPalette = defaultPalettePattern.test(code);
    const hasRawColor = colorLiteralPattern.test(code) && !insideShadowValue && !shadowOrMaskPattern.test(code);
    if (hasLegacyColor || hasDefaultPalette || hasRawColor) {
      failures.push(`${sourcePath}:${index + 1}: ${line.trim()}`);
    }
    if (insideShadowValue && code.includes(';')) insideShadowValue = false;
  }
}

if (failures.length > 0) {
  process.stderr.write(`Unregistered color usage:\n${failures.join('\n')}\n`);
  process.exitCode = 1;
}
