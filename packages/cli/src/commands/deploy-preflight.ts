import type { Dirent } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type PreflightIssueCode = 'MISSING_ENV_VAR' | 'LOCAL_STORAGE_PATH';

export interface PreflightIssue {
  code: PreflightIssueCode;
  severity: 'error' | 'warning';
  message: string;
  fix: string;
}

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

/**
 * Env vars the runtime/platform sets automatically — referencing these in
 * user code is fine even when not present in the user's `.env` file.
 */
const ENV_VAR_ALLOWLIST_EXACT = new Set([
  'PORT',
  'HOST',
  'HOSTNAME',
  'NODE_ENV',
  'NODE_OPTIONS',
  'PWD',
  'HOME',
  'USER',
  'PATH',
  'TZ',
  'LANG',
  'CI',
  // Framework/tooling sentinel flags read by bundled dependencies (debug,
  // pino, @mastra/* internals). Referencing these from the bundle is
  // expected and shouldn't be surfaced as a missing-env-var warning.
  'DEBUG',
  'DEBUG_FD',
  'DEBUG_COLORS',
  'DEBUG_DEPTH',
  'DEBUG_HIDE_DATE',
  'NO_COLOR',
  'FORCE_COLOR',
  'EXPERIMENTAL_FEATURES',
  'SKILLS_BASE_DIR',
  'AUTO_BLOCK_EXTERNAL_PROVIDERS',
]);

/**
 * Prefixes for env vars set by the platform, runtime, or tooling.
 */
const ENV_VAR_ALLOWLIST_PREFIXES = [
  'MASTRA_',
  'npm_',
  'OTEL_',
  'NEXT_',
  'VERCEL_',
  'AWS_LAMBDA_',
  // Observational memory internal flags
  'OM_',
];

/**
 * Metadata emitted by the `mastra-local-storage-detector` Rollup plugin
 * during bundling.  Each entry represents a host-local URL found in a
 * *user* module (node_modules are excluded) that survived tree-shaking.
 */
interface LocalStorageDetection {
  value: string;
  hint: string;
  module: string;
  /**
   * Env var that guards this literal at runtime (the literal is the fallback
   * arm of a `process.env.X || literal` expression). Only present in
   * `preflight-metadata.json` — the legacy file never carries it.
   */
  guardedBy?: string;
}

/**
 * Unified metadata emitted by newer deployers as `preflight-metadata.json`.
 * `userEnvRefs` lists the env vars referenced from *user* modules only, so
 * the missing-env-var check doesn't warn about vars read by bundled library
 * code the project never references.
 */
interface PreflightMetadata {
  version: number;
  localPaths: LocalStorageDetection[];
  userEnvRefs: string[];
}

/** Legacy metadata file emitted by older deployers (and still emitted by newer ones). */
const LOCAL_PATHS_METADATA_FILE = 'preflight-local-paths.json';

/** Unified metadata file emitted by newer deployers. */
const PREFLIGHT_METADATA_FILE = 'preflight-metadata.json';

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Inspect a built `.mastra/output` directory plus the env vars about to be
 * uploaded and return a list of issues that are likely to cause the deploy
 * to fail with a USER-attributable error.
 *
 * Returns an empty array when no build output is found — the caller is
 * responsible for surfacing the missing-output error.
 */
export async function preflightBuildOutput(
  targetDir: string,
  envVars: Record<string, string>,
  options: {
    /**
     * Whether the CLI has the full env picture for this deploy (an explicit
     * `--env-file` or an ambient `.env*` file). When false, env vars may be
     * stored on the platform and invisible to the CLI, so env-guarded local
     * paths are surfaced as warnings instead of errors. Defaults to true —
     * every caller except the unified deploy always reads an env file.
     */
    hasEnvFile?: boolean;
  } = {},
): Promise<PreflightIssue[]> {
  const { hasEnvFile = true } = options;
  const outputDir = join(targetDir, '.mastra', 'output');
  const entryPath = join(outputDir, 'index.mjs');

  // If there's no build output yet, there's nothing to check. The deploy
  // command verifies the entry exists separately.
  try {
    await stat(entryPath);
  } catch {
    return [];
  }

  // Unified metadata from newer deployers. Absent for stale builds or older
  // deployers — each check falls back to its previous behavior.
  const metadata = await readPreflightMetadata(outputDir);

  const issues: PreflightIssue[] = [];

  if (metadata) {
    // User modules' env refs were captured structurally at build time, so
    // library-only refs inside the bundle never produce warnings.
    issues.push(...checkEnvVarNames(metadata.userEnvRefs, envVars));
  } else {
    const bundleSources = await readBundleSources(outputDir);
    const combinedSource = bundleSources.join('\n');
    issues.push(...checkMissingEnvVars(combinedSource, envVars));
  }

  // LOCAL_STORAGE_PATH — read from bundler-generated metadata.  The Rollup
  // plugin `mastra-local-storage-detector` runs during bundling and only
  // reports paths from user modules (not node_modules) that survived
  // tree-shaking, so library examples are structurally excluded.
  issues.push(...(await checkLocalStoragePaths(outputDir, metadata, envVars, hasEnvFile)));

  return issues;
}

export type PreflightOutcome = 'ok' | 'blocked' | 'cancelled';

/**
 * Print preflight issues and decide whether the deploy should proceed.
 *
 * Returns:
 * - `'ok'`     — no issues, or warnings the caller has accepted.
 * - `'blocked'`— at least one error-severity issue. Errors always block,
 *                regardless of `autoAccept` / headless mode. Caller should
 *                exit non-zero so CI surfaces the failure.
 * - `'cancelled'` — warnings only, but the user explicitly declined the
 *                confirmation prompt. Caller should exit zero (normal
 *                user-initiated cancel).
 *
 * `--skip-preflight` is the escape hatch when a check is a false positive.
 */
export async function printPreflightIssues(
  issues: PreflightIssue[],
  options: { autoAccept: boolean },
): Promise<PreflightOutcome> {
  if (issues.length === 0) return 'ok';

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  for (const issue of warnings) {
    p.log.warn(`${pc.yellow(`[${issue.code}]`)} ${issue.message}\n  ${pc.dim('→')} ${issue.fix}`);
  }

  for (const issue of errors) {
    p.log.error(`${pc.red(`[${issue.code}]`)} ${issue.message}\n  ${pc.dim('→')} ${issue.fix}`);
  }

  if (errors.length > 0) {
    p.log.error(
      `Deploy blocked by ${errors.length} preflight error(s). ` +
        `Fix the issues above, or pass --skip-preflight to override.`,
    );
    return 'blocked';
  }

  // Warnings only.
  if (options.autoAccept) return 'ok';

  const confirmed = await p.confirm({
    message: `Found ${warnings.length} preflight warning(s). Deploy anyway?`,
    initialValue: true,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    return 'cancelled';
  }

  return 'ok';
}

/* ------------------------------------------------------------------ */
/*  Bundle reading                                                    */
/* ------------------------------------------------------------------ */

async function readBundleSources(outputDir: string): Promise<string[]> {
  const files = await collectMjsFiles(outputDir);
  const contents = await Promise.all(files.map(f => readFile(f, 'utf-8').catch(() => '')));
  return contents;
}

async function collectMjsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Array<Dirent | string>;
  try {
    entries = (await readdir(dir, { withFileTypes: true })) as Array<Dirent | string>;
  } catch {
    return out;
  }
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry.name;
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const isDir = typeof entry === 'string' ? false : entry.isDirectory?.() === true;
    const isFile = typeof entry === 'string' ? true : entry.isFile?.() === true;
    if (isDir) {
      out.push(...(await collectMjsFiles(full)));
    } else if (isFile && (name.endsWith('.mjs') || name.endsWith('.js'))) {
      out.push(full);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Check 1 — missing env vars                                        */
/* ------------------------------------------------------------------ */

const PROCESS_ENV_REGEX = /\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g;
const PROCESS_ENV_BRACKET_REGEX = /\bprocess\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g;

/**
 * Fallback for builds without `preflight-metadata.json`: regex-scan the whole
 * bundle (user + library code) for `process.env.X` references.
 */
function checkMissingEnvVars(source: string, envVars: Record<string, string>): PreflightIssue[] {
  const referenced = new Set<string>();
  for (const match of source.matchAll(PROCESS_ENV_REGEX)) {
    referenced.add(match[1]!);
  }
  for (const match of source.matchAll(PROCESS_ENV_BRACKET_REGEX)) {
    referenced.add(match[1]!);
  }

  return checkEnvVarNames([...referenced], envVars);
}

function checkEnvVarNames(referenced: Iterable<string>, envVars: Record<string, string>): PreflightIssue[] {
  const provided = new Set(Object.keys(envVars));
  const missing: string[] = [];

  for (const name of new Set(referenced)) {
    if (provided.has(name)) continue;
    if (ENV_VAR_ALLOWLIST_EXACT.has(name)) continue;
    if (ENV_VAR_ALLOWLIST_PREFIXES.some(prefix => name.startsWith(prefix))) continue;
    missing.push(name);
  }

  if (missing.length === 0) return [];

  missing.sort();
  return [
    {
      code: 'MISSING_ENV_VAR',
      severity: 'warning',
      message: `Build references ${missing.length} env var(s) not in the env file being deployed: ${missing.join(', ')}`,
      fix: `Add them to your env file, or confirm your code provides a fallback (e.g. \`process.env.X ?? 'default'\`).`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Check 2 — local storage paths (bundler-generated metadata)        */
/* ------------------------------------------------------------------ */

/**
 * Read the unified `preflight-metadata.json` emitted by newer deployers.
 * Returns null when absent or malformed (stale build / older deployer).
 */
async function readPreflightMetadata(outputDir: string): Promise<PreflightMetadata | null> {
  try {
    const raw = await readFile(join(outputDir, PREFLIGHT_METADATA_FILE), 'utf-8');
    const parsed = JSON.parse(raw) as PreflightMetadata;
    if (parsed.version !== 1 || !Array.isArray(parsed.localPaths) || !Array.isArray(parsed.userEnvRefs)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check detections written by the `mastra-local-storage-detector` Rollup
 * plugin.  Prefers the unified metadata (which carries `guardedBy` env
 * context); falls back to the legacy `preflight-local-paths.json`.  If both
 * are absent (e.g. older build, or the plugin wasn't active) the check is
 * silently skipped — no false positives.
 */
async function checkLocalStoragePaths(
  outputDir: string,
  metadata: PreflightMetadata | null,
  envVars: Record<string, string>,
  hasEnvFile: boolean,
): Promise<PreflightIssue[]> {
  let detections: LocalStorageDetection[];
  if (metadata) {
    detections = metadata.localPaths;
  } else {
    try {
      const raw = await readFile(join(outputDir, LOCAL_PATHS_METADATA_FILE), 'utf-8');
      detections = JSON.parse(raw) as LocalStorageDetection[];
    } catch {
      return [];
    }
  }

  if (!Array.isArray(detections) || detections.length === 0) return [];

  const issues: PreflightIssue[] = [];

  for (const d of detections) {
    if (!d.guardedBy) {
      issues.push({
        code: 'LOCAL_STORAGE_PATH',
        severity: 'error',
        message: `Build contains a host-local storage URL: ${truncate(d.value, 80)} (${d.hint})`,
        fix: `Replace it with a hosted URL (e.g. a Turso \`libsql://...\` URL or a public Postgres connection string) and store it in your env file.`,
      });
      continue;
    }

    // The literal is a dead fallback when the guarding env var is set in the
    // deploy environment. An empty value doesn't count: `process.env.X || 'file:...'`
    // still takes the fallback at runtime when X is blank.
    if (envVars[d.guardedBy]) continue;

    if (hasEnvFile) {
      issues.push({
        code: 'LOCAL_STORAGE_PATH',
        severity: 'error',
        message: `${truncate(d.value, 80)} will be used at runtime because ${d.guardedBy} is not set (${d.hint})`,
        fix: `Set ${d.guardedBy} in your env file, or remove the local fallback.`,
      });
    } else {
      issues.push({
        code: 'LOCAL_STORAGE_PATH',
        severity: 'warning',
        message: `${truncate(d.value, 80)} will be used at runtime unless ${d.guardedBy} is set — cannot verify ${d.guardedBy} is set on the platform (${d.hint})`,
        fix: `Ensure ${d.guardedBy} is set in the target environment, or pass --env-file so preflight can verify it locally.`,
      });
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
