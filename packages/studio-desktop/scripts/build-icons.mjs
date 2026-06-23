import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(packageRoot, 'build');
const sourceIconPackage = join(buildDir, 'mastra.icon');
const sourceIconConfig = join(sourceIconPackage, 'icon.json');
const iconTool =
  process.env.MASTRA_DESKTOP_ICON_TOOL ??
  '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool';
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

function requireFile(path, installHint) {
  if (!existsSync(path)) {
    throw new Error(`${path} is required to regenerate Studio Desktop icons. ${installHint}`);
  }
}

requireCommand('magick', 'Install ImageMagick or edit the generated build/icon.* assets directly.');
requireCommand('iconutil', 'iconutil is included with macOS.');
requireFile(iconTool, 'Install Xcode with Icon Composer or set MASTRA_DESKTOP_ICON_TOOL.');

function getIconLayerSvg() {
  const config = JSON.parse(readFileSync(sourceIconConfig, 'utf8'));
  const layer = config.groups?.[0]?.layers?.[0];
  if (!layer?.['image-name']) {
    throw new Error('build/mastra.icon must include one SVG layer in icon.json');
  }

  return readFileSync(join(sourceIconPackage, 'Assets', layer['image-name']), 'utf8');
}

function normalizePng(path) {
  const normalizedPath = `${path}.normalized.png`;
  run('magick', [path, '-colorspace', 'sRGB', '-depth', '8', '-type', 'TrueColorAlpha', normalizedPath]);
  renameSync(normalizedPath, path);
}

function exportIconPng(path, width, height = width, scale = 1) {
  run(iconTool, [
    sourceIconPackage,
    '--export-image',
    '--output-file',
    path,
    '--platform',
    'macOS',
    '--rendition',
    'Default',
    '--width',
    String(width),
    '--height',
    String(height),
    '--scale',
    String(scale),
  ]);
  normalizePng(path);
}

writeFileSync(sourceSvg, `${getIconLayerSvg().trimEnd()}\n`);
exportIconPng(sourcePng, 512, 512, 2);

const iconsetDir = mkdtempSync(join(tmpdir(), 'mastra-studio-iconset-'));
const iconsetPath = `${iconsetDir}.iconset`;

try {
  rmSync(iconsetPath, { force: true, recursive: true });
  mkdirSync(iconsetPath, { recursive: true });

  const iconsetSizes = [
    ['icon_16x16.png', 16, 1],
    ['icon_16x16@2x.png', 16, 2],
    ['icon_32x32.png', 32, 1],
    ['icon_32x32@2x.png', 32, 2],
    ['icon_128x128.png', 128, 1],
    ['icon_128x128@2x.png', 128, 2],
    ['icon_256x256.png', 256, 1],
    ['icon_256x256@2x.png', 256, 2],
    ['icon_512x512.png', 512, 1],
    ['icon_512x512@2x.png', 512, 2],
  ];

  for (const [filename, size, scale] of iconsetSizes) {
    exportIconPng(join(iconsetPath, filename), size, size, scale);
  }

  run('iconutil', ['--convert', 'icns', '--output', iconIcns, iconsetPath]);

  const icoPngs = [16, 32, 48, 64, 128, 256].map(size => {
    const path = join(iconsetDir, `icon-${size}.png`);
    exportIconPng(path, size, size, 1);
    return path;
  });
  run('magick', [...icoPngs, iconIco]);
} finally {
  rmSync(iconsetDir, { force: true, recursive: true });
  rmSync(iconsetPath, { force: true, recursive: true });
}
