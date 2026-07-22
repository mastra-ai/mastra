#!/usr/bin/env node
/**
 * Validates that `.mastra/output` is present and deploy-ready before
 * `mastra deploy --skip-build` runs. Exits non-zero on any problem so
 * the deploy chain aborts instead of uploading a broken bundle.
 *
 * Checks:
 *   1. `.mastra/output/index.mjs` — the server entry exists
 *   2. `.mastra/output/package.json` — the deploy manifest exists and
 *      has no `link:` / `workspace:` / `@internal/` specs (would break
 *      `npm install` at deploy time)
 *   3. SPA `index.html` — present in `factory/` under the output dir
 *   4. Factory `SKILL.md` files — packaged alongside the Web server bundle
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(webRoot, '.mastra', 'output');

let failures = 0;

function fail(msg) {
  console.error(`✖ ${msg}`);
  failures++;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

// 1. Server entry
const indexMjs = path.join(outputDir, 'index.mjs');
if (!fs.existsSync(indexMjs)) {
  fail('.mastra/output/index.mjs not found — run `pnpm web:build` first');
} else {
  ok('server entry (.mastra/output/index.mjs)');
}

// 2. Deploy manifest
const outputPkgPath = path.join(outputDir, 'package.json');
if (!fs.existsSync(outputPkgPath)) {
  fail('.mastra/output/package.json not found — run `pnpm web:build` first');
} else {
  const pkg = JSON.parse(fs.readFileSync(outputPkgPath, 'utf8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const bad = Object.entries(deps).filter(
    ([, spec]) => /^link:/.test(spec) || /^workspace:/.test(spec) || spec === 'latest' || /^@internal\//.test(spec),
  );
  if (bad.length > 0) {
    for (const [name, spec] of bad) {
      fail(`output package.json has non-installable spec: ${name}: ${spec}`);
    }
  } else {
    ok(`deploy manifest (${Object.keys(deps).length} deps, all installable)`);
  }
}

// 3. SPA
const spaPath = path.join(outputDir, 'factory', 'index.html');
if (!fs.existsSync(spaPath)) {
  fail('SPA index.html not found in .mastra/output/factory/ — run `pnpm web:build` (includes vite build)');
} else {
  ok(`SPA (${path.relative(outputDir, spaPath)})`);
}

// 4. Web Factory skills
for (const skillName of ['configure-factory-rules', 'understand-issue', 'understand-pr']) {
  const relativeSkillPath = path.join('factory-skills', skillName, 'SKILL.md');
  const skillPath = path.join(outputDir, relativeSkillPath);
  if (!fs.existsSync(skillPath)) {
    fail(`Factory skill not found: ${relativeSkillPath}`);
  } else {
    ok(`Factory skill (${relativeSkillPath})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s) — aborting deploy`);
  process.exit(1);
}
console.log('\noutput validated — ready to deploy');
