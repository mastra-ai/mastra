import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The preload pins this before Mastra bundles source into .mastra/output. */
export const templateRoot = resolve(
  process.env.TEMPLATE_ROOT ?? dirname(fileURLToPath(import.meta.url)),
  process.env.TEMPLATE_ROOT ? '.' : '..',
);
const localBackendDefault = 'file:.data/local-demo.db';
const localClientDefault = 'file:.data/local-demo-client.db';
const externalBackendDefault = 'file:mastra.db';
const externalClientDefault = 'file:.data/northstar-demo.db';

function value(environment, name) {
  return environment[name]?.trim() || undefined;
}
/**
 * Resolve the external backend from the raw configuration captured before the
 * preload changes DATABASE_URL for a local child process. DATABASE_URL is the
 * canonical setting; TURSO_DATABASE_URL remains a fallback for existing
 * environments while they migrate.
 */
export function externalDatabaseUrl(environment = process.env) {
  const canonical = Object.hasOwn(environment, 'ORIGINAL_DATABASE_URL')
    ? value(environment, 'ORIGINAL_DATABASE_URL')
    : value(environment, 'DATABASE_URL');
  const legacy = Object.hasOwn(environment, 'ORIGINAL_TURSO_DATABASE_URL')
    ? value(environment, 'ORIGINAL_TURSO_DATABASE_URL')
    : value(environment, 'TURSO_DATABASE_URL');
  return canonical ?? legacy;
}

function externalValue(environment, name) {
  const original = `ORIGINAL_${name}`;
  return Object.hasOwn(environment, original) ? value(environment, original) : value(environment, name);
}

/** APP_MODE is authoritative.  Old explicit provider opt-ins retain their
 * external behavior only when APP_MODE was not yet added to that environment. */
export function appMode(environment = process.env) {
  const explicit = value(environment, 'APP_MODE')?.toLowerCase();
  if (explicit) {
    if (!['local', 'staging', 'production'].includes(explicit))
      throw new Error('APP_MODE must be local, staging, or production.');
    return explicit;
  }
  return value(environment, 'SUPPORT_SOURCE')?.toLowerCase() === 'intercom' ||
    value(environment, 'COMMERCE_SOURCE')?.toLowerCase() === 'stripe'
    ? 'staging'
    : 'local';
}

export function isLocalMode(environment = process.env) {
  return appMode(environment) === 'local';
}

export function hasExplicitExternalMode(environment = process.env) {
  const explicit = value(environment, 'APP_MODE')?.toLowerCase();
  return explicit === 'staging' || explicit === 'production';
}

export function hasExplicitStagingMode(environment = process.env) {
  const mode = appMode(environment);
  return mode === 'staging' && value(environment, 'APP_MODE')?.toLowerCase() === 'staging';
}

function absoluteFileUrl(value, fallback, root = templateRoot) {
  const raw = value?.trim() || fallback;
  if (!raw.startsWith('file:') || raw.includes(':memory:')) return raw;
  return new URL(raw, pathToFileURL(`${root}/`)).href;
}

function filePath(url) {
  if (!url.startsWith('file:')) return undefined;
  let path = fileURLToPath(url);
  const tail = [];
  while (!existsSync(path)) {
    const parent = dirname(path);
    if (parent === path) return resolve(path);
    tail.unshift(basename(path));
    path = parent;
  }
  return resolve(realpathSync(path), ...tail);
}
function sameFile(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  try {
    const a = statSync(left),
      b = statSync(right);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}

export function databaseProfile(environment = process.env) {
  const mode = appMode(environment);
  const local = mode === 'local';
  return {
    mode,
    backend: absoluteFileUrl(
      local ? value(environment, 'LOCAL_DEMO_DATABASE_URL') : externalDatabaseUrl(environment),
      local ? localBackendDefault : externalBackendDefault,
    ),
    client: local
      ? absoluteFileUrl(value(environment, 'LOCAL_DEMO_CLIENT_DATABASE_URL'), localClientDefault)
      : (externalValue(environment, 'DEMO_DATABASE_URL') ?? externalClientDefault),
  };
}

/** Refuse aliases even before the file exists. This avoids silently joining
 * profile histories through relative paths or an existing symlink. */
export function assertDatabaseIsolation(environment = process.env) {
  const selected = databaseProfile(environment);
  const localBackend = absoluteFileUrl(value(environment, 'LOCAL_DEMO_DATABASE_URL'), localBackendDefault);
  const localClient = absoluteFileUrl(value(environment, 'LOCAL_DEMO_CLIENT_DATABASE_URL'), localClientDefault);
  const externalBackend = absoluteFileUrl(externalDatabaseUrl(environment), externalBackendDefault);
  const externalClient = absoluteFileUrl(
    externalValue(environment, 'DEMO_DATABASE_URL'),
    externalClientDefault,
    resolve(templateRoot, 'client-demo-ui'),
  );
  const localPaths = [filePath(localBackend), filePath(localClient)].filter(Boolean);
  const externalPaths = [filePath(externalBackend), filePath(externalClient)].filter(Boolean);
  if (localPaths.some(path => externalPaths.some(other => sameFile(path, other))))
    throw new Error('Local and external database profiles must use different files.');
  if (isLocalMode(environment)) {
    if (
      (!selected.backend.startsWith('file:') || selected.backend.includes(':memory:')) &&
      environment.VITEST !== 'true'
    )
      throw new Error('LOCAL_DEMO_DATABASE_URL must be a persistent file: URL.');
    if ((!selected.client.startsWith('file:') || selected.client.includes(':memory:')) && environment.VITEST !== 'true')
      throw new Error('LOCAL_DEMO_CLIENT_DATABASE_URL must be a persistent file: URL.');
    if (sameFile(filePath(selected.backend), filePath(selected.client)))
      throw new Error('Local backend and client databases must use different files.');
  }
  if (
    hasExplicitExternalMode(environment) &&
    (!externalDatabaseUrl(environment) || !externalValue(environment, 'DEMO_DATABASE_URL'))
  )
    throw new Error('External APP_MODE requires DATABASE_URL and DEMO_DATABASE_URL.');
  return selected;
}

export function applyModeToEnvironment(environment = process.env) {
  const profile = assertDatabaseIsolation(environment);
  // Keep raw configuration intact. Mastra's preloader uses the resolved value
  // only for its child process, while subsequent profile checks must still see
  // the external URLs that were supplied by the user.
  if (value(environment, 'APP_MODE')?.toLowerCase() === 'local') {
    environment.SUPPORT_SOURCE = 'mock';
    environment.COMMERCE_SOURCE = 'mock';
  } else if (hasExplicitExternalMode(environment)) {
    environment.SUPPORT_SOURCE = 'intercom';
    environment.COMMERCE_SOURCE = 'stripe';
  }
  return profile;
}
