import type { Dirent } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { DatabaseKind } from './db/platform-api.js';
import { DB_ENV_VAR_NAMES } from './db/platform-api.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type PreflightIssueCode = 'MISSING_ENV_VAR' | 'LOCAL_STORAGE_PATH';

/**
 * Structured hint describing how deploy can offer to auto-fix an issue
 * before it becomes a blocking error. Consumed by
 * `deploy/auto-provision-database.ts` when running in an interactive TTY.
 */
export type PreflightAutofix = {
  kind: 'create-managed-database';
  provider: DatabaseKind;
  envVarName: string;
};

export interface PreflightIssue {
  code: PreflightIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /**
   * Remediation. A single string renders as one arrow line; an array renders
   * as one arrow line per entry so multi-step fixes (run this command, OR set
   * this env var) stay legible instead of collapsing into a wall of text.
   */
  fix: string | string[];
  autofix?: PreflightAutofix;
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
     * paths are surfaced as warnings instead of errors. Defaults to true.
     */
    hasEnvFile?: boolean;
    /**
     * Env var names the platform injects at deploy time (e.g. TURSO_DATABASE_URL
     * from an attached managed database) — names only, values are platform-side
     * secrets. Three states:
     * - `string[]` — platform env context fetched and the field was present:
     *   the env picture is complete, so guarded local paths whose var is
     *   neither provided nor managed are trustworthy hard errors.
     * - `null` — platform env context fetched but the field was absent (older
     *   platform, or an endpoint that doesn't expose names): the picture is
     *   incomplete, so guarded misses soften to warnings.
     * - `undefined` — no platform context at all (lint, studio deploy):
     *   severity falls back to `hasEnvFile`.
     */
    managedEnvVarNames?: string[] | null;
    /**
     * User-facing name of the environment being deployed to (`production`,
     * `staging`, etc.) — threaded into remediation text so the printed
     * `mastra env db create <env> --kind ...` reads like a command a human
     * would type. NOT the slug: on some platforms the production env's slug
     * is derived from the project name (e.g. `my-app-xyz-1234`), which the
     * platform's env-resolver accepts but is jarring to see printed back.
     * The env-resolver accepts id, name, or slug, so name is safe.
     * Omit for lint / studio contexts.
     */
    environmentName?: string;
  } = {},
): Promise<PreflightIssue[]> {
  const { hasEnvFile = true, managedEnvVarNames, environmentName } = options;
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
    issues.push(...checkEnvVarNames(metadata.userEnvRefs, envVars, managedEnvVarNames));
  } else {
    const bundleSources = await readBundleSources(outputDir);
    const combinedSource = bundleSources.join('\n');
    issues.push(...checkMissingEnvVars(combinedSource, envVars, managedEnvVarNames));
  }

  // LOCAL_STORAGE_PATH — read from bundler-generated metadata.  The Rollup
  // plugin `mastra-local-storage-detector` runs during bundling and only
  // reports paths from user modules (not node_modules) that survived
  // tree-shaking, so library examples are structurally excluded.
  issues.push(
    ...(await checkLocalStoragePaths(outputDir, metadata, envVars, hasEnvFile, managedEnvVarNames, environmentName)),
  );

  return issues;
}

/**
 * Mirror the platform's deploy-time env merge: local/request env vars are
 * applied over the vars already stored on the target environment or server
 * project (request wins). Preflight should see this merged picture so vars
 * stored only on the platform don't produce false MISSING_ENV_VAR /
 * LOCAL_STORAGE_PATH alarms.
 */
export function mergePreflightEnvVars(
  stored: Record<string, string> | null | undefined,
  local: Record<string, string>,
): Record<string, string> {
  return { ...stored, ...local };
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

  const renderFix = (fix: string | string[]): string => {
    const steps = Array.isArray(fix) ? fix : [fix];
    return steps.map(step => `  ${pc.dim('→')} ${step}`).join('\n');
  };

  for (const issue of warnings) {
    p.log.warn(`${pc.yellow(`[${issue.code}]`)} ${issue.message}\n${renderFix(issue.fix)}`);
  }

  for (const issue of errors) {
    p.log.error(`${pc.red(`[${issue.code}]`)} ${issue.message}\n${renderFix(issue.fix)}`);
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
function checkMissingEnvVars(
  source: string,
  envVars: Record<string, string>,
  managedEnvVarNames?: string[] | null,
): PreflightIssue[] {
  const referenced = new Set<string>();
  for (const match of source.matchAll(PROCESS_ENV_REGEX)) {
    referenced.add(match[1]!);
  }
  for (const match of source.matchAll(PROCESS_ENV_BRACKET_REGEX)) {
    referenced.add(match[1]!);
  }

  return checkEnvVarNames([...referenced], envVars, managedEnvVarNames);
}

/** Env vars the platform/runtime sets automatically at deploy time. */
function isPlatformProvidedEnvVar(name: string): boolean {
  return ENV_VAR_ALLOWLIST_EXACT.has(name) || ENV_VAR_ALLOWLIST_PREFIXES.some(prefix => name.startsWith(prefix));
}

function checkEnvVarNames(
  referenced: Iterable<string>,
  envVars: Record<string, string>,
  managedEnvVarNames?: string[] | null,
): PreflightIssue[] {
  const provided = new Set(Object.keys(envVars));
  const managed = new Set(managedEnvVarNames ?? []);
  const missing: string[] = [];

  for (const name of new Set(referenced)) {
    if (provided.has(name)) continue;
    if (managed.has(name)) continue;
    if (isPlatformProvidedEnvVar(name)) continue;
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
/**
 * The exact command that unblocks a missing database env var. Kind-specific
 * when the guarded var maps to a known provider (issue 35-B: the remediation
 * previously said "attach a managed database" without ever naming the command).
 */
export function dbCreateCommandFor(envVarName: string, environmentName?: string): string {
  // env name goes BEFORE flags because it's a positional argument on
  // `mastra env db create`, not a flag. Scoping to the target environment
  // matters after 8816f47: `mastra env db create` with no arg errors in
  // non-interactive shells when multiple environments exist, which is
  // exactly where preflight failures land (CI).
  //
  // We use the environment NAME (`production`, `staging`), not the platform
  // slug. On some platforms the production env's slug is derived from the
  // project name (e.g. `my-app-xyz-1234`) — technically accepted by the
  // env-resolver (which matches id | name | slug), but jarring to see
  // printed back and awkward to type. The name is what the user thinks of
  // as the environment identifier, so that's what we print.
  const envArg = environmentName ? ` ${environmentName}` : '';
  for (const [kind, names] of Object.entries(DB_ENV_VAR_NAMES)) {
    if (names.includes(envVarName)) return `mastra env db create${envArg} --kind ${kind}`;
  }
  return `mastra env db create${envArg}`;
}

/**
 * If `envVarName` is injected by a known managed database provider, return
 * the structured autofix hint deploy uses to offer inline provisioning.
 * Returns undefined for env vars that don't map to a provider — those still
 * get a text-only fix.
 */
export function dbAutofixFor(envVarName: string): PreflightAutofix | undefined {
  for (const [kind, names] of Object.entries(DB_ENV_VAR_NAMES) as [DatabaseKind, string[]][]) {
    if (names.includes(envVarName)) {
      return { kind: 'create-managed-database', provider: kind, envVarName };
    }
  }
  return undefined;
}

async function checkLocalStoragePaths(
  outputDir: string,
  metadata: PreflightMetadata | null,
  envVars: Record<string, string>,
  hasEnvFile: boolean,
  managedEnvVarNames?: string[] | null,
  environmentName?: string,
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

    // Guards on vars the platform/runtime sets automatically (e.g.
    // MASTRA_STORAGE_URL on Mastra Cloud) are trusted the same way the
    // missing-env-var check trusts them — the guard is satisfied at runtime
    // even though the var never appears in a local env file.
    if (isPlatformProvidedEnvVar(d.guardedBy)) continue;

    // The literal is a dead fallback when the guarding env var is set in the
    // deploy environment. An empty value doesn't count: `process.env.X || 'file:...'`
    // still takes the fallback at runtime when X is blank.
    if (envVars[d.guardedBy]) continue;

    // Managed platform resources (e.g. an attached Turso database) inject
    // their vars at deploy time; the platform exposes the names so preflight
    // knows the guard is satisfied even though the value is invisible here.
    if (managedEnvVarNames?.includes(d.guardedBy)) continue;

    if (managedEnvVarNames !== undefined) {
      if (managedEnvVarNames === null) {
        // Platform context was fetched but didn't expose managed names (older
        // platform, or the server-project env endpoint which doesn't carry
        // them yet) — the env picture is incomplete, so don't hard-block.
        // TODO(managed-env-names): once every platform env endpoint exposes
        // managedEnvVarNames, drop this branch and always hard-error.
        issues.push({
          code: 'LOCAL_STORAGE_PATH',
          severity: 'warning',
          message: `${truncate(d.value, 80)} will be used at runtime unless ${d.guardedBy} is set — cannot verify whether the platform injects it (${d.hint})`,
          fix: `Set ${d.guardedBy} in your env file or the environment's stored vars. If a managed database injects it, you can ignore this.`,
        });
      } else {
        // Full env picture: local env file + stored vars + managed names.
        // The guard var is genuinely absent, so the local fallback WILL be
        // used at runtime — trustworthy hard error.
        const autofix = dbAutofixFor(d.guardedBy);
        // Only recommend `mastra env db create` when we recognize the guard
        // var as belonging to a managed provider we can actually provision.
        // Suggesting the command for arbitrary vars (e.g. MY_CUSTOM_DB_URL)
        // would tell users to spin up infra that can't inject their var.
        const envVarFix = `Set ${d.guardedBy} in your env file or the environment's stored vars`;
        issues.push({
          code: 'LOCAL_STORAGE_PATH',
          severity: 'error',
          message: `${truncate(d.value, 80)} will be used at runtime because ${d.guardedBy} is not set (${d.hint})`,
          fix: autofix
            ? [
                `Run \`${dbCreateCommandFor(d.guardedBy, environmentName)}\` to attach a managed database`,
                `Or ${envVarFix.charAt(0).toLowerCase()}${envVarFix.slice(1)}`,
              ]
            : envVarFix,
          autofix,
        });
      }
    } else if (hasEnvFile) {
      const autofix = dbAutofixFor(d.guardedBy);
      const envVarFix = `Set ${d.guardedBy} in your env file`;
      const platformFix = `If the platform already injects it, re-run with --skip-preflight`;
      issues.push({
        code: 'LOCAL_STORAGE_PATH',
        severity: 'error',
        message: `${truncate(d.value, 80)} will be used at runtime because ${d.guardedBy} is not set (${d.hint})`,
        fix: autofix
          ? [
              `Run \`${dbCreateCommandFor(d.guardedBy, environmentName)}\` to attach a managed database`,
              `Or ${envVarFix.charAt(0).toLowerCase()}${envVarFix.slice(1)}`,
              platformFix,
            ]
          : [envVarFix, platformFix],
        autofix,
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
