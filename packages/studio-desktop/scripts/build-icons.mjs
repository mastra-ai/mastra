import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(packageRoot, 'build');
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

run('magick', ['-background', 'none', sourceSvg, '-resize', '1024x1024', '-colorspace', 'sRGB', '-depth', '8', '-type', 'TrueColorAlpha', sourcePng]);

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
    run('magick', [sourcePng, '-resize', `${size}x${size}`, '-colorspace', 'sRGB', '-depth', '8', '-type', 'TrueColorAlpha', join(iconsetPath, filename)]);
  }

  run('iconutil', ['--convert', 'icns', '--output', iconIcns, iconsetPath]);
  run('magick', [sourcePng, '-define', 'icon:auto-resize=256,128,64,48,32,16', iconIco]);
} finally {
  rmSync(iconsetDir, { force: true, recursive: true });
  rmSync(iconsetPath, { force: true, recursive: true });
}
