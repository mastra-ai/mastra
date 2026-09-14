#!/usr/bin/env node
/**
 * Idempotent shallow-fetch of NangoHQ/integration-templates at the pinned SHA
 * into `packages/connect/.templates/`. Safe to re-run: skips work when the
 * current checkout is already at the pinned SHA.
 *
 * This is a maintainer-only script; the templates cache is gitignored and
 * never ships with the package.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEMPLATE_REPO, TEMPLATE_SHA } from './templates-config.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = resolve(packageRoot, '.templates');

function run(cmd: string, args: string[], cwd?: string, quiet = false): string {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'],
    encoding: 'utf8',
  }).trim();
}

function main(): void {
  const remote = `https://github.com/${TEMPLATE_REPO}.git`;

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
    run('git', ['init', '--quiet'], cacheDir);
    run('git', ['remote', 'add', 'origin', remote], cacheDir);
  }

  // A deliberate repository pin change must also update an existing cache.
  run('git', ['remote', 'set-url', 'origin', remote], cacheDir);

  // Detect current SHA (empty if brand-new).
  let currentSha = '';
  try {
    currentSha = run('git', ['rev-parse', 'HEAD'], cacheDir, true);
  } catch {
    // No HEAD yet — fresh clone.
  }

  // Resolve pinned ref to a concrete SHA.
  const targetSha =
    TEMPLATE_SHA === 'main'
      ? run('git', ['ls-remote', 'origin', 'refs/heads/main'], cacheDir).split(/\s/)[0]!
      : TEMPLATE_SHA;

  if (currentSha === targetSha) {
    console.log(`[sync-templates] Cache already at ${targetSha.slice(0, 12)} — nothing to do.`);
    return;
  }

  console.log(`[sync-templates] Fetching ${TEMPLATE_REPO}@${targetSha.slice(0, 12)} …`);
  run('git', ['fetch', '--depth', '1', 'origin', targetSha], cacheDir);
  run('git', ['checkout', '--quiet', targetSha], cacheDir);
  console.log(`[sync-templates] Ready at ${targetSha.slice(0, 12)}.`);
}

main();
