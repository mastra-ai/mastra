import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(packageRoot, 'build');
const sourceIconPackage = join(buildDir, 'mastra.icon');
const sourceIconConfig = join(sourceIconPackage, 'icon.json');
const sourceSvg = join(buildDir, 'icon.svg');
const sourcePng = join(buildDir, 'icon.png');
const iconIcns = join(buildDir, 'icon.icns');
const iconIco = join(buildDir, 'icon.ico');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function commandExists(command) {
  try {
    execFileSync('command', ['-v', command], { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

function requireCommand(command, installHint) {
  if (!commandExists(command)) {
    throw new Error(`${command} is required to regenerate Studio Desktop icons. ${installHint}`);
  }
}

requireCommand('magick', 'Install ImageMagick or edit the generated build/icon.* assets directly.');
requireCommand('iconutil', 'iconutil is included with macOS.');

function parseColor(value, fallback) {
  const match = /(?:display-p3|extended-srgb):([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/.exec(value ?? '');
  if (!match) return fallback;

  const [, red, green, blue] = match;
  return `rgb(${Math.round(Number(red) * 255)} ${Math.round(Number(green) * 255)} ${Math.round(Number(blue) * 255)})`;
}

function extractSvgBody(svg) {
  return svg
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
}

function buildFlattenedSvg() {
  const config = JSON.parse(readFileSync(sourceIconConfig, 'utf8'));
  const layer = config.groups?.[0]?.layers?.[0];
  if (!layer?.['image-name']) {
    throw new Error('build/mastra.icon must include one SVG layer in icon.json');
  }

  const logoSvg = readFileSync(join(sourceIconPackage, 'Assets', layer['image-name']), 'utf8');
  const logoBody = extractSvgBody(logoSvg);
  const gradient = config.fill?.['linear-gradient'] ?? [];
  const startColor = parseColor(gradient[0], '#000000');
  const stopColor = parseColor(gradient[1], '#191919');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Mastra Studio">
  <defs>
    <linearGradient id="background" x1="512" y1="0" x2="512" y2="716.8" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${startColor}" />
      <stop offset="1" stop-color="${stopColor}" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#background)" />
  <g transform="translate(172 299) scale(1)">
${logoBody
  .replace(/fill="[^"]*"/g, 'fill="#ffffff"')
  .split('\n')
  .map(line => `    ${line}`)
  .join('\n')}
  </g>
</svg>
`;
}

writeFileSync(sourceSvg, buildFlattenedSvg());
run('magick', [
  '-background',
  'none',
  sourceSvg,
  '-resize',
  '1024x1024',
  '-colorspace',
  'sRGB',
  '-depth',
  '8',
  '-type',
  'TrueColorAlpha',
  sourcePng,
]);

const iconsetDir = mkdtempSync(join(tmpdir(), 'mastra-studio-iconset-'));
const iconsetPath = `${iconsetDir}.iconset`;

try {
  rmSync(iconsetPath, { force: true, recursive: true });
  run('mkdir', ['-p', iconsetPath]);

  const iconsetSizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ];

  for (const [filename, size] of iconsetSizes) {
    run('magick', [
      sourcePng,
      '-resize',
      `${size}x${size}`,
      '-colorspace',
      'sRGB',
      '-depth',
      '8',
      '-type',
      'TrueColorAlpha',
      join(iconsetPath, filename),
    ]);
  }

  run('iconutil', ['--convert', 'icns', '--output', iconIcns, iconsetPath]);
  run('magick', [sourcePng, '-define', 'icon:auto-resize=256,128,64,48,32,16', iconIco]);
} finally {
  rmSync(iconsetDir, { force: true, recursive: true });
  rmSync(iconsetPath, { force: true, recursive: true });
}
