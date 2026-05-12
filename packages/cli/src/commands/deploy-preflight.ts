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
 * Connection-string-shaped patterns that resolve to the build host and will
 * never work inside the deploy container.
 */
const LOCAL_HOST_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\bfile:\.{1,2}\/[^\s'"`]+\.(?:db|sqlite)\b/i,
    hint: 'LibSQL/SQLite file path relative to the build host',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*localhost\b/i,
    hint: 'localhost in a connection string',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*127\.0\.0\.1\b/,
    hint: '127.0.0.1 in a connection string',
  },
];

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
): Promise<PreflightIssue[]> {
  const outputDir = join(targetDir, '.mastra', 'output');
  const entryPath = join(outputDir, 'index.mjs');

  // If there's no build output yet, there's nothing to check. The deploy
  // command verifies the entry exists separately.
  try {
    await stat(entryPath);
  } catch {
    return [];
  }

  const bundleSources = await readBundleSources(outputDir);
  const combinedSource = bundleSources.join('\n');

  const issues: PreflightIssue[] = [];

  issues.push(...checkMissingEnvVars(combinedSource, envVars));
  issues.push(...checkLocalStoragePaths(combinedSource));

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
    // Tests sometimes mock readdir with plain string arrays — fall back to stat
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

function checkMissingEnvVars(source: string, envVars: Record<string, string>): PreflightIssue[] {
  const referenced = new Set<string>();
  for (const match of source.matchAll(PROCESS_ENV_REGEX)) {
    referenced.add(match[1]!);
  }
  for (const match of source.matchAll(PROCESS_ENV_BRACKET_REGEX)) {
    referenced.add(match[1]!);
  }

  const provided = new Set(Object.keys(envVars));
  const missing: string[] = [];

  for (const name of referenced) {
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
/*  Check 2 — local storage paths                                     */
/* ------------------------------------------------------------------ */

function checkLocalStoragePaths(source: string): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const seen = new Set<string>();

  for (const { pattern, hint } of LOCAL_HOST_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const match of source.matchAll(globalPattern)) {
      const value = match[0];
      const key = `${hint}::${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      issues.push({
        code: 'LOCAL_STORAGE_PATH',
        severity: 'error',
        message: `Build contains a host-local storage URL: ${truncate(value, 80)} (${hint})`,
        fix: `Replace it with a hosted URL (e.g. a Turso \`libsql://...\` URL or a public Postgres connection string) and store it in your env file.`,
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
