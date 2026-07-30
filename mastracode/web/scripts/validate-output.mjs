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
import { createRequire } from 'node:module';
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
  fail('.mastra/output/index.mjs not found — run `npm run build` first');
} else {
  ok('server entry (.mastra/output/index.mjs)');
}

// 2. Deploy manifest
const outputPkgPath = path.join(outputDir, 'package.json');
if (!fs.existsSync(outputPkgPath)) {
  fail('.mastra/output/package.json not found — run `npm run build` first');
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
  fail('SPA index.html not found in .mastra/output/factory/ — run `npm run build` first');
} else {
  ok(`SPA (${path.relative(outputDir, spaPath)})`);
}

// 4. Web Factory skills — the bundled copy must mirror the canonical set in
// @mastra/factory exactly (same skills, byte-identical files), so a broken
// sync can't ship stale, missing, or leftover skill content.
const require = createRequire(path.join(webRoot, 'package.json'));
const canonicalSkillsDir = path.join(path.dirname(require.resolve('@mastra/factory/package.json')), 'factory-skills');
const outputSkillsDir = path.join(outputDir, 'factory-skills');

function listSkillDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

function listFilesRecursive(dir, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(path.join(dir, entry.name), relative));
    } else {
      files.push(relative);
    }
  }
  return files;
}

const canonicalSkills = listSkillDirs(canonicalSkillsDir);
const outputSkills = listSkillDirs(outputSkillsDir);
if (canonicalSkills.length === 0) {
  fail(`no canonical factory skills found at ${canonicalSkillsDir}`);
}
for (const skillName of new Set([...canonicalSkills, ...outputSkills])) {
  if (!canonicalSkills.includes(skillName)) {
    fail(
      `Factory skill is stale: factory-skills/${skillName} is not in @mastra/factory — sync-factory-skills.mjs did not run`,
    );
    continue;
  }
  if (!outputSkills.includes(skillName)) {
    fail(`Factory skill not found: factory-skills/${skillName}`);
    continue;
  }
  const canonicalDir = path.join(canonicalSkillsDir, skillName);
  const outputSkillDir = path.join(outputSkillsDir, skillName);
  const canonicalFiles = listFilesRecursive(canonicalDir);
  const outputFiles = listFilesRecursive(outputSkillDir);
  const drifted = [];
  for (const file of new Set([...canonicalFiles, ...outputFiles])) {
    const canonicalFile = path.join(canonicalDir, file);
    const outputFile = path.join(outputSkillDir, file);
    if (
      !fs.existsSync(canonicalFile) ||
      !fs.existsSync(outputFile) ||
      !fs.readFileSync(canonicalFile).equals(fs.readFileSync(outputFile))
    ) {
      drifted.push(file);
    }
  }
  if (drifted.length > 0) {
    fail(
      `Factory skill is stale: factory-skills/${skillName} differs from @mastra/factory (${drifted.join(', ')}) — sync-factory-skills.mjs did not run`,
    );
  } else {
    ok(`Factory skill (factory-skills/${skillName}, ${canonicalFiles.length} files)`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s) — aborting deploy`);
  process.exit(1);
}
console.log('\noutput validated — ready to deploy');
