#!/usr/bin/env node
// Captures the boneyard skeletons (`src/bones/*.bones.json`) from the Storybook stories titled
// `Bones/…`. Each story renders a real component with fixture data inside a named <BoneSkeleton>;
// boneyard's CLI loads the story in Chromium and records the layout at each breakpoint.
//
//   pnpm bones:capture          rebuild Storybook, recapture, overwrite src/bones/*.bones.json
//   pnpm bones:capture --check  recapture to a temp dir and fail if it differs from src/bones
//
// Needs Playwright Chromium: `pnpm exec playwright install chromium`.
//
// Run `bones:check` before pushing; no CI job runs it yet. A unit test (src/bones/bones-coverage.test.ts)
// fails when a <BoneSkeleton name> has no committed bones. Fixtures use `DataList.RowStatic`:
// boneyard captures a <button> as one bone, so `RowButton` rows lose their per-cell bones. Small
// one-off placeholders keep using the ds `Skeleton` / `SkeletonText`.
import { execFileSync, spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bonesDir = join(packageRoot, 'src/bones');
const storybookDir = join(packageRoot, 'node_modules/.cache/bones-storybook');
const check = process.argv.includes('--check');

const BREAKPOINTS = '375,768,1280';
const WAIT_MS = '800';
// Same shape and every number within TOLERANCE. Bone x/width are percentages and y/height pixels;
// text metrics wobble by a fraction of either between runs, a real layout change moves far more.
const TOLERANCE = 1;

execFileSync('pnpm', ['exec', 'storybook', 'build', '--quiet', '-o', storybookDir], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: { ...process.env, BONES_CAPTURE: '1' },
});

const index = JSON.parse(readFileSync(join(storybookDir, 'index.json'), 'utf8'));
const storyIds = Object.values(index.entries)
  .filter(entry => entry.type === 'story' && entry.title.startsWith('Bones/'))
  .map(entry => entry.id)
  .sort();

if (storyIds.length === 0) {
  console.error('No stories titled "Bones/…" in the Storybook build.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(storybookDir, `.${pathname}`);
  if (!file.startsWith(storybookDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const outDir = mkdtempSync(join(tmpdir(), 'bones-'));
try {
  const cli = createRequire(import.meta.url)
    .resolve('boneyard-js/package.json')
    .replace(/package\.json$/, 'bin/cli.js');
  const urls = storyIds.map(id => `${origin}/iframe.html?id=${id}&viewMode=story`);
  // Async so the static server keeps answering while the CLI runs.
  await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [cli, 'build', ...urls, '--out', outDir, '--breakpoints', BREAKPOINTS, '--wait', WAIT_MS, '--no-scan', '--force'],
      { cwd: packageRoot, stdio: 'inherit' },
    );
    child.on('exit', code => (code === 0 ? done() : fail(new Error(`boneyard-js build exited with ${code}`))));
  });

  const captured = readBones(outDir);
  // boneyard only fails when nothing at all is captured, so a story that didn't mount its skeleton
  // would otherwise drop that bone file silently. Each Bones/ story renders exactly one named skeleton.
  if (Object.keys(captured).length !== storyIds.length) {
    throw new Error(
      `boneyard captured ${Object.keys(captured).length} skeletons from ${storyIds.length} Bones/ stories. Each Bones/ story must render one <BoneSkeleton> with a unique name.`,
    );
  }

  if (check) {
    const committed = readBones(bonesDir);
    const names = new Set([...Object.keys(captured), ...Object.keys(committed)]);
    const stale = [...names].filter(name => {
      const difference = firstDifference(captured[name], committed[name], name);
      if (difference) console.error(difference);
      return difference !== undefined;
    });
    if (stale.length > 0) {
      console.error(
        `\nBones out of date: ${stale.join(', ')}. Run \`pnpm --filter ./packages/playground-ui bones:capture\` and commit src/bones/.`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\nBones up to date (${names.size}).`);
    }
  } else {
    for (const file of readdirSync(bonesDir).filter(file => file.endsWith('.bones.json'))) {
      rmSync(join(bonesDir, file));
    }
    for (const [name, data] of Object.entries(captured)) {
      writeFileSync(join(bonesDir, `${name}.bones.json`), `${JSON.stringify(data, null, 2)}\n`);
    }
    console.log(`\nWrote ${Object.keys(captured).length} bones to src/bones/.`);
  }
} finally {
  server.close();
  rmSync(outDir, { recursive: true, force: true });
}

// Normalised to one decimal place and without `_hash` (boneyard only uses it to skip unchanged
// skeletons), so a recapture of an unchanged story writes an identical file.
function readBones(dir) {
  const bones = {};
  for (const file of readdirSync(dir).filter(file => file.endsWith('.bones.json'))) {
    const { _hash, ...data } = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    bones[file.replace(/\.bones\.json$/, '')] = round(data);
  }
  return bones;
}

function round(value) {
  if (typeof value === 'number') return Math.round(value * 10) / 10;
  if (Array.isArray(value)) return value.map(round);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, round(inner)]));
  }
  return value;
}

function firstDifference(a, b, path) {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= TOLERANCE ? undefined : `${path}: ${b} -> ${a}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: ${b.length} -> ${a.length} entries`;
    for (let i = 0; i < a.length; i++) {
      const difference = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (difference) return difference;
    }
    return undefined;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const difference = firstDifference(a[key], b[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return undefined;
  }
  return isDeepStrictEqual(a, b) ? undefined : `${path}: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`;
}
