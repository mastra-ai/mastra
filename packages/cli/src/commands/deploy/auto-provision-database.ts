/**
 * Deploy-time auto-provision hook.
 *
 * When preflight detects that a required database env var will be missing at
 * runtime (`TURSO_DATABASE_URL`, `DATABASE_URL`, …), deploy would normally
 * error out and tell the user to run `mastra env db create`. That's an extra
 * command, an extra CLI cycle, and a papercut on top of an otherwise happy
 * deploy.
 *
 * Instead, this module inspects preflight issues with a
 * `create-managed-database` autofix hint, asks the user once per provider
 * whether they want to attach a managed database now, and — if they say yes —
 * runs the attach + poll inline. Successfully-provisioned providers are
 * dropped from the issue list and their injected env var names are added to
 * `managedEnvVarNames`, so the caller can hand the survivors to
 * `printPreflightIssues` and let deploy continue.
 */

import * as p from '@clack/prompts';
import { defaultDatabaseName } from '../db/db.js';
import type { DatabaseKind, ProjectDatabase } from '../db/platform-api.js';
import { attachDatabase, DB_ENV_VAR_NAMES, fetchDatabaseCatalog, pollDatabaseUntilReady } from '../db/platform-api.js';
import type { PreflightAutofix, PreflightIssue } from '../deploy-preflight.js';
import type { Environment } from '../env/platform-api.js';

export interface AutoProvisionContext {
  token: string;
  orgId: string;
  projectId: string;
  /** Human-readable project name, used to derive a default database name. */
  projectName: string;
  /** Project slug, used to derive a default database name. */
  projectSlug: string | null;
  environment: Pick<Environment, 'id' | 'slug' | 'name' | 'type'>;
  /**
   * Skip the auto-provision flow entirely (`--yes` / `--auto-accept`). We
   * treat "accept all defaults" as "don't prompt me for infrastructure
   * creation" — auto-accept should never silently spin up managed
   * resources. Users who want provisioning in CI should run
   * `mastra env db create` in a separate step.
   */
  autoAccept: boolean;
}

export interface AutoProvisionResult {
  /** Issues left after successful provisioning (unfixed ones passed through). */
  issues: PreflightIssue[];
  /** Env var names newly injected by databases we just attached. */
  newlyManagedEnvVarNames: string[];
  /** Databases we attached in this run (for later summaries). */
  provisioned: ProjectDatabase[];
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

function collectAutofixes(issues: PreflightIssue[]): Map<DatabaseKind, PreflightAutofix[]> {
  const byProvider = new Map<DatabaseKind, PreflightAutofix[]>();
  for (const issue of issues) {
    const fix = issue.autofix;
    if (!fix || fix.kind !== 'create-managed-database') continue;
    const bucket = byProvider.get(fix.provider) ?? [];
    bucket.push(fix);
    byProvider.set(fix.provider, bucket);
  }
  return byProvider;
}

/**
 * Expand a preflight autofix's primary provider into the ordered list of
 * candidate providers whose managed databases inject at least one of the same
 * env vars, filtered to the ones this org actually has in its catalog.
 *
 * The primary (whatever `dbAutofixFor` picked first — currently `neon` for
 * DATABASE_URL) stays first so its label is the default option in the
 * `p.select` prompt. Other candidates come in DB_ENV_VAR_NAMES insertion
 * order for stable UX.
 */
function candidateProviders(
  primary: DatabaseKind,
  envVarNames: string[],
  availableKinds: Set<DatabaseKind>,
): DatabaseKind[] {
  const seen = new Set<DatabaseKind>([primary]);
  const list: DatabaseKind[] = [primary];
  for (const envVarName of envVarNames) {
    for (const [kind, names] of Object.entries(DB_ENV_VAR_NAMES) as [DatabaseKind, string[]][]) {
      if (seen.has(kind)) continue;
      if (!availableKinds.has(kind)) continue;
      if (!names.includes(envVarName)) continue;
      seen.add(kind);
      list.push(kind);
    }
  }
  return list;
}

/** Human-friendly label for the multi-provider select prompt. */
const PROVIDER_LABEL: Record<DatabaseKind, string> = {
  turso: 'Turso',
  neon: 'Neon (serverless, public)',
  postgres: 'Postgres (VPC-isolated)',
  redis: 'Redis',
  mongodb: 'MongoDB',
};

async function confirmProvision(
  provider: DatabaseKind,
  envVarNames: string[],
  environmentName: string,
): Promise<DatabaseKind | null> {
  const confirm = await p.confirm({
    message:
      `Preflight needs ${envVarNames.join(', ')} for the ${environmentName} environment. ` +
      `Create a managed ${provider} database now and attach it?`,
    initialValue: true,
  });
  if (p.isCancel(confirm)) {
    p.cancel('Deploy cancelled.');
    process.exit(0);
  }
  return confirm ? provider : null;
}

async function selectProvision(
  candidates: DatabaseKind[],
  envVarNames: string[],
  environmentName: string,
): Promise<DatabaseKind | null> {
  const options = [
    ...candidates.map(kind => ({ value: kind as DatabaseKind | 'skip', label: PROVIDER_LABEL[kind] ?? kind })),
    { value: 'skip' as const, label: 'Skip — set it manually later' },
  ];
  const selection = await p.select({
    message:
      `Preflight needs ${envVarNames.join(', ')} for the ${environmentName} environment. ` +
      `Which managed database should be provisioned?`,
    options,
    initialValue: candidates[0],
  });
  if (p.isCancel(selection)) {
    p.cancel('Deploy cancelled.');
    process.exit(0);
  }
  return selection === 'skip' ? null : (selection as DatabaseKind);
}

/**
 * If preflight surfaced blocking issues we know how to auto-fix (missing
 * managed database env vars), offer to fix them inline. Non-interactive
 * callers get the original issues back untouched — the caller is expected to
 * fall through to `printPreflightIssues`, which will still print the exact
 * `mastra env db create` command in the error text.
 */
export async function maybeAutoProvisionDatabases(
  issues: PreflightIssue[],
  ctx: AutoProvisionContext,
): Promise<AutoProvisionResult> {
  const untouched: AutoProvisionResult = {
    issues,
    newlyManagedEnvVarNames: [],
    provisioned: [],
  };

  const grouped = collectAutofixes(issues);
  if (grouped.size === 0) return untouched;

  // Prompting requires a TTY; --yes should not silently create infra without
  // an explicit yes to a specific provider.
  if (!isInteractive() || ctx.autoAccept) return untouched;

  // The platform filters the provider catalog per-organization (feature
  // flags, e.g. `managed-redis`). Only offer kinds the platform would let
  // this org attach — the same gate the dashboard UI uses. Fail closed on
  // errors, matching the platform: a flag-service hiccup must not lead to
  // prompts whose attach would then be rejected anyway.
  let availableKinds: Set<DatabaseKind>;
  try {
    const catalog = await fetchDatabaseCatalog(ctx.token, ctx.orgId, ctx.projectId);
    availableKinds = new Set(catalog.filter(entry => entry.status === 'available').map(entry => entry.kind));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.warn(`Could not check managed database availability (${message}); skipping auto-provisioning.`);
    return untouched;
  }

  const resolved = new Set<PreflightAutofix>();
  const newlyManaged: string[] = [];
  const provisioned: ProjectDatabase[] = [];

  for (const [provider, fixes] of grouped) {
    // Silently skip kinds the platform doesn't offer this org — mirrors the
    // dashboard, where a gated provider simply doesn't appear.
    if (!availableKinds.has(provider)) continue;

    const uniqueVars = [...new Set(fixes.map(f => f.envVarName))];
    // Some env vars (e.g. DATABASE_URL) can be satisfied by more than one
    // provider — Neon (public serverless) or the VPC-only Railway Postgres.
    // When multiple candidates are actually offered by this org, we present a
    // choice instead of hard-coding the primary that dbAutofixFor happened to
    // pick.
    const candidates = candidateProviders(provider, uniqueVars, availableKinds);

    const chosen =
      candidates.length === 1
        ? await confirmProvision(provider, uniqueVars, ctx.environment.name)
        : await selectProvision(candidates, uniqueVars, ctx.environment.name);
    if (!chosen) continue;

    try {
      const created = await provisionOne(ctx, chosen);
      provisioned.push(created);
      const injected = DB_ENV_VAR_NAMES[chosen] ?? [];
      newlyManaged.push(...injected);
      for (const fix of fixes) resolved.add(fix);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(`Failed to attach a ${chosen} database: ${message}`);
      // Leave the fixes in the issue list — the normal error printer will
      // show the exact `mastra env db create` command as remediation.
    }
  }

  if (resolved.size === 0) return untouched;

  const remaining = issues.filter(issue => !issue.autofix || !resolved.has(issue.autofix));
  return {
    issues: remaining,
    newlyManagedEnvVarNames: newlyManaged,
    provisioned,
  };
}

async function provisionOne(ctx: AutoProvisionContext, provider: DatabaseKind): Promise<ProjectDatabase> {
  const name = defaultDatabaseName(
    provider,
    { name: ctx.projectName, slug: ctx.projectSlug },
    { name: ctx.environment.name, slug: ctx.environment.slug, type: ctx.environment.type },
  );
  const created = await attachDatabase(ctx.token, ctx.orgId, ctx.projectId, {
    kind: provider,
    name,
    environmentId: ctx.environment.id,
  });

  const spinner = p.spinner();
  spinner.start(`Provisioning ${provider} database "${created.name}"...`);
  try {
    const ready = await pollDatabaseUntilReady(ctx.token, ctx.orgId, ctx.projectId, created.id, {
      onStatus: status => spinner.message(`Provisioning ${provider} database "${created.name}" — ${status}`),
    });
    spinner.stop(`Database "${ready.name}" is ready and attached to the ${ctx.environment.name} environment.`);
    return ready;
  } catch (error) {
    spinner.stop('Provisioning failed.');
    throw error;
  }
}
