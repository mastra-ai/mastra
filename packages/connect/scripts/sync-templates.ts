#!/usr/bin/env node
/**
 * Idempotent shallow-fetch of the pinned template source into
 * `packages/connect/.templates/`. Safe to re-run: skips work when the current
 * checkout is already at the pinned SHA.
 *
 * Usage: sync-templates [providerId]
 *
 * With a provider id, the checkout is moved to that provider's pin (see
 * `TEMPLATE_PIN_OVERRIDES`); without one, to the shared upstream pin.
 *
 * This is a maintainer-only script; the templates cache is gitignored and
 * never ships with the package.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { templatePinFor } from './templates-config.js';

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
  const providerId = process.argv[2];
  const pin = templatePinFor(providerId);
  const remote = `https://github.com/${pin.repo}.git`;

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
    pin.sha === 'main' ? run('git', ['ls-remote', 'origin', 'refs/heads/main'], cacheDir).split(/\s/)[0]! : pin.sha;

  if (currentSha === targetSha) {
    console.log(`[sync-templates] Cache already at ${targetSha.slice(0, 12)} — nothing to do.`);
    return;
  }

  console.log(`[sync-templates] Fetching ${pin.repo}@${targetSha.slice(0, 12)} …`);
  run('git', ['fetch', '--depth', '1', 'origin', targetSha], cacheDir);
  run('git', ['checkout', '--quiet', targetSha], cacheDir);
  console.log(`[sync-templates] Ready at ${targetSha.slice(0, 12)}.`);
}

main();
