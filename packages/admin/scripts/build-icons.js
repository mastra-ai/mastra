const path = require('node:path');
const { parse } = require('node-html-parser');
const fsExtra = require('fs-extra');
const { glob } = require('glob');

const cwd = process.cwd();
const inputDir = path.join(cwd, 'src', 'icons');
const inputDirRelative = path.relative(cwd, inputDir);
const typeDir = path.join(cwd, 'src', 'types');
const outputDir = path.join(cwd, 'public', 'icons');
const iconArrDir = path.join(cwd, 'src', 'components', 'ui', 'svg');

async function main() {
  await fsExtra.ensureDir(outputDir);
  await fsExtra.ensureDir(typeDir);
  await fsExtra.ensureDir(iconArrDir);

  // get all the icons, and ignore the 'custom' folder
  const files = glob
    .sync('**/*.svg', {
      cwd: inputDir,
      ignore: {
        childrenIgnored: p => p.isNamed('custom'),
      },
    })
    .sort((a, b) => a.localeCompare(b));

  const shouldVerboseLog = process.argv.includes('--log=verbose');
  const logVerbose = shouldVerboseLog ? console.log : () => {};

  //check if we've got any file
  if (files.length === 0) {
    return logVerbose(`No SVG files found in ${inputDirRelative}`);
  }
  generateIconFiles(files, logVerbose);
}

function iconName(file) {
  return file.replace(/\.svg$/, '').replace(/\\/g, '/');
}

async function writeIfChanged(filepath, newContent, logVerbose) {
  const currentContent = await fsExtra.readFile(filepath, 'utf-8').catch(() => {
    logVerbose('Could not read file');
  });

  if (currentContent === newContent) return false;
  await fsExtra.writeFile(filepath, newContent, 'utf-8');
  return true;
}

async function generateSvgSprite(files, inputDir, outputPath, logVerbose) {
  //For our sprite, each SVG becomes a symbol and we wrap them all in a single SVG

  const symbols = await Promise.all(
    files.map(async file => {
      const input = await fsExtra.readFile(path.join(inputDir, file), 'utf-8');
      const root = parse(input);

      const svg = root.querySelector('svg');
      if (!svg) throw new Error('No SVG element found in file');

      svg.tagName = 'symbol';
      svg.setAttribute('id', iconName(file));
      svg.removeAttribute('xmlns');
      svg.removeAttribute('xmlns:xlink');
      svg.removeAttribute('version');
      svg.removeAttribute('width');
      svg.removeAttribute('height');

      svg.querySelectorAll('path').forEach(path => {
        const hasFillColor = path.hasAttribute('fill');
        if (hasFillColor) {
          path.setAttribute('fill', 'currentColor');
        }
      });

      svg.querySelectorAll('circle').forEach(circle => {
        const hasFillColor = circle.hasAttribute('fill');
        if (hasFillColor) {
          circle.setAttribute('fill', 'currentColor');
        }
      });

      svg.querySelectorAll('rect').forEach(rect => {
        const hasFillColor = rect.hasAttribute('fill');
        if (hasFillColor) {
          rect.setAttribute('fill', 'currentColor');
        }
      });

      return svg.toString().trim();
    }),
  );

  const output = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<!-- This file is generated automatically by pnpm run build:icons -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0">`,
    `<defs>`,
    ...symbols,
    `</defs>`,
    `</svg>`,
    '', // trailing newline
  ].join('\n');

  return writeIfChanged(outputPath, output, logVerbose);
}

async function generateIconFiles(files, logVerbose) {
  const spriteFilepath = path.join(outputDir, 'sprite.svg');
  const typeOutputFilepath = path.join(typeDir, 'icons.d.ts');
  const iconArrFilePath = path.join(iconArrDir, 'iconArr.ts');
  const currentSprite = await fsExtra.readFile(spriteFilepath, 'utf-8').catch(() => {
    logVerbose('Could not get read file');
  });
  const currentTypes = await fsExtra.readFile(typeOutputFilepath, 'utf-8').catch(() => {
    logVerbose('Could not get read file');
  });

  const iconNames = files.map(file => iconName(file));

  const spriteUpToDate = iconNames.every(iconName => currentSprite?.includes(`id=${iconName}`));
  const typesUpToDate = iconNames.every(iconName => currentTypes?.includes(`"${iconName}"`));

  if (spriteUpToDate && typesUpToDate) {
    return logVerbose('Icons are already up to date');
  }

  logVerbose(`🚀 Generating sprite for ${inputDirRelative}`);

  const spriteChanged = await generateSvgSprite(files, inputDir, spriteFilepath, logVerbose);

  for (const file of files) {
    logVerbose('✅', file);
  }

  logVerbose(`Saved to ${path.relative(cwd, spriteFilepath)}`);

  const stringifiedIconNames = iconNames.map(name => JSON.stringify(name));

  const iconArrContent = `//This file is generated automatically by pnpm run build:icons
export const iconArr = [${stringifiedIconNames}]
  `;
  await writeIfChanged(iconArrFilePath, iconArrContent, logVerbose);

  const typeOutputContent = `//This file is generated automatically by pnpm run build:icons
export type IconName = \t| ${stringifiedIconNames.join('\n\t| ')};\n`;

  const typesChanged = await writeIfChanged(typeOutputFilepath, typeOutputContent, logVerbose);

  logVerbose(`Manifest saved to ${path.relative(cwd, typeOutputFilepath)}`);

  if (spriteChanged || typesChanged) {
    logVerbose(`Generated ${files.length} icons`);
  }
}
main();
