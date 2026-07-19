/**
 * Rewrites intra-repo dependencies to `workspace:*` ahead of a snapshot publish.
 *
 * Only packages that actually live in this workspace are rewritten. The `@mastra`
 * scope on npm also carries packages that are NOT developed here (the Docusaurus
 * plugins the docs site depends on, for example), and pointing those at
 * `workspace:*` makes the follow-up install fail with ERR_PNPM_WORKSPACE_PKG_NOT_FOUND.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

// `pnpm ls -r` is the authority on workspace membership — it resolves
// pnpm-workspace.yaml's globs rather than re-implementing them here.
const projects = JSON.parse(execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { encoding: 'utf8' }));

const members = new Map(projects.filter(project => project.name && project.path).map(p => [p.name, p.path]));

let changedCount = 0;

for (const [name, path] of members) {
  const manifestPath = join(path, 'package.json');
  let manifest;
  try {
    manifest = readFileSync(manifestPath, 'utf8');
  } catch {
    continue;
  }

  const parsed = JSON.parse(manifest);
  let touched = false;

  for (const field of DEP_FIELDS) {
    for (const [dep, range] of Object.entries(parsed[field] ?? {})) {
      // Normalize ranges that already opted into the workspace protocol
      // (`workspace:^` and friends) and pin true workspace members onto it.
      // Anything else — including same-scope packages resolved from the
      // registry — is left exactly as the manifest declares it.
      const shouldPin = String(range).startsWith('workspace:') || members.has(dep);
      if (!shouldPin || range === 'workspace:*') continue;

      parsed[field][dep] = 'workspace:*';
      touched = true;
    }
  }

  if (touched) {
    // Trailing newline keeps the diff clean against prettier-formatted manifests.
    writeFileSync(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`);
    console.log(`Updating ${name} (${manifestPath})`);
    changedCount += 1;
  }
}

const skipped = projects.length - members.size;
console.log(`Finished updating workspace dependencies. ${changedCount} files updated.`);
if (skipped > 0) console.log(`Skipped ${skipped} project(s) without a resolvable name/path.`);
