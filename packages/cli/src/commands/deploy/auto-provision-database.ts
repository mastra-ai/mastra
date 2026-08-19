/**
 * Interactive deploy-time handlers for structured preflight autofixes.
 *
 * Infrastructure is never created for non-interactive or `--yes` deploys.
 * Interactive deploys prompt once per managed database provider and once for
 * background workers, apply confirmed fixes in dependency order (databases
 * before workers), and remove only successfully-resolved issues.
 */

import * as p from '@clack/prompts';
import { defaultDatabaseName } from '../db/db.js';
import type { DatabaseKind, ProjectDatabase } from '../db/platform-api.js';
import { attachDatabase, DB_ENV_VAR_NAMES, pollDatabaseUntilReady } from '../db/platform-api.js';
import type { PreflightAutofix, PreflightIssue } from '../deploy-preflight.js';
import type { Environment } from '../env/platform-api.js';
import { enableBackgroundWorkers } from '../env/platform-api.js';

type DatabaseAutofix = Extract<PreflightAutofix, { kind: 'create-managed-database' }>;
type WorkerAutofix = Extract<PreflightAutofix, { kind: 'enable-background-workers' }>;

interface AutofixGroup {
  fix: PreflightAutofix;
  members: PreflightAutofix[];
}

export interface AutoProvisionContext {
  token: string;
  orgId: string;
  projectId: string;
  /** Human-readable project name, used to derive a default database name. */
  projectName: string;
  /** Project slug, used to derive a default database name. */
  projectSlug: string | null;
  environment: Pick<Environment, 'id' | 'slug' | 'name' | 'type' | 'managedEnvVarNames' | 'envVars'>;
  /** Merged local and platform-stored env vars used to identify BYO Redis. */
  envVars: Record<string, string>;
  /**
   * Skip autofixes entirely (`--yes` / `--auto-accept`). Accepting command
   * defaults must never silently create managed infrastructure.
   */
  autoAccept: boolean;
}

export interface AutoProvisionResult {
  /** Issues left after successful autofixes (unfixed ones pass through). */
  issues: PreflightIssue[];
  /** Env var names newly injected by databases attached in this run. */
  newlyManagedEnvVarNames: string[];
  /** Databases attached in this run (for the deploy summary). */
  provisioned: ProjectDatabase[];
  /** Whether this run successfully enabled dedicated background workers. */
  backgroundWorkersEnabled: boolean;
}

interface AutofixState {
  newlyManagedEnvVarNames: string[];
  provisioned: ProjectDatabase[];
  backgroundWorkersEnabled: boolean;
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

function collectAutofixes(issues: PreflightIssue[]): AutofixGroup[] {
  const databases = new Map<DatabaseKind, DatabaseAutofix[]>();
  const workers: WorkerAutofix[] = [];

  for (const issue of issues) {
    const fix = issue.autofix;
    if (!fix) continue;

    switch (fix.kind) {
      case 'create-managed-database': {
        const bucket = databases.get(fix.provider) ?? [];
        bucket.push(fix);
        databases.set(fix.provider, bucket);
        break;
      }
      case 'enable-background-workers':
        workers.push(fix);
        break;
    }
  }

  return [
    ...[...databases.values()].map(members => ({ fix: members[0]!, members })),
    ...(workers.length > 0 ? [{ fix: workers[0]!, members: workers }] : []),
  ];
}

/**
 * Offer to apply supported preflight fixes inline. Non-interactive callers get
 * the original issues back untouched so normal preflight output still shows
 * deterministic remediation.
 */
export async function maybeApplyPreflightAutofixes(
  issues: PreflightIssue[],
  ctx: AutoProvisionContext,
): Promise<AutoProvisionResult> {
  const untouched: AutoProvisionResult = {
    issues,
    newlyManagedEnvVarNames: [],
    provisioned: [],
    backgroundWorkersEnabled: false,
  };

  const groups = collectAutofixes(issues);
  if (groups.length === 0 || !isInteractive() || ctx.autoAccept) return untouched;

  const resolved = new Set<PreflightAutofix>();
  const state: AutofixState = {
    newlyManagedEnvVarNames: [],
    provisioned: [],
    backgroundWorkersEnabled: false,
  };

  for (const group of groups) {
    if (await handleAutofix(group.fix, ctx, state)) {
      for (const fix of group.members) resolved.add(fix);
    }
  }

  if (resolved.size === 0 && state.provisioned.length === 0) return untouched;

  return {
    issues: issues.filter(issue => !issue.autofix || !resolved.has(issue.autofix)),
    ...state,
  };
}

async function handleAutofix(fix: PreflightAutofix, ctx: AutoProvisionContext, state: AutofixState): Promise<boolean> {
  switch (fix.kind) {
    case 'create-managed-database':
      return handleDatabaseAutofix(fix, ctx, state);
    case 'enable-background-workers':
      return handleWorkerAutofix(ctx, state);
  }
}

async function handleDatabaseAutofix(
  fix: DatabaseAutofix,
  ctx: AutoProvisionContext,
  state: AutofixState,
): Promise<boolean> {
  const providerEnvVars = DB_ENV_VAR_NAMES[fix.provider] ?? [];
  const confirm = await p.confirm({
    message:
      `Preflight needs ${providerEnvVars.join(', ')} for the ${ctx.environment.slug} environment. ` +
      `Create a managed ${fix.provider} database now and attach it?`,
    initialValue: true,
  });

  if (p.isCancel(confirm)) cancelDeploy();
  if (!confirm) return false;

  try {
    const created = await provisionOne(ctx, fix.provider);
    state.provisioned.push(created);
    state.newlyManagedEnvVarNames.push(...providerEnvVars);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Failed to attach a ${fix.provider} database: ${message}`);
    return false;
  }
}

async function handleWorkerAutofix(ctx: AutoProvisionContext, state: AutofixState): Promise<boolean> {
  const managedNames = [...(ctx.environment.managedEnvVarNames ?? []), ...state.newlyManagedEnvVarNames];
  const hasManagedRedis = managedNames.includes('REDIS_URL');
  // BYO Redis must come from the vars *stored* on the environment — the
  // platform resolves the worker's Redis URL from stored vars, and local
  // `.env` vars are only uploaded with the deploy itself (after this runs).
  const hasByoRedis = Boolean(ctx.environment.envVars?.REDIS_URL) && !hasManagedRedis;
  const hasLocalOnlyRedis = !hasManagedRedis && !hasByoRedis && Boolean(ctx.envVars.REDIS_URL);
  if (hasLocalOnlyRedis) {
    p.log.info(
      `REDIS_URL is set in your local env but not yet stored on the ${ctx.environment.name} environment. ` +
        `It will be uploaded with this deploy — re-run \`mastra deploy\` afterwards to enable background workers.`,
    );
    return false;
  }

  const confirm = await p.confirm({
    message:
      `Background tasks are enabled in your Mastra config. ` +
      `Enable dedicated background workers for the ${ctx.environment.name} environment?` +
      (!hasManagedRedis && !hasByoRedis ? ' A managed Redis database will also be created and attached.' : ''),
    initialValue: true,
  });

  if (p.isCancel(confirm)) cancelDeploy();
  if (!confirm) return false;

  let redisSource: 'managed' | 'byo' = hasByoRedis ? 'byo' : 'managed';
  if (!hasManagedRedis && !hasByoRedis) {
    try {
      const created = await provisionOne(ctx, 'redis');
      state.provisioned.push(created);
      state.newlyManagedEnvVarNames.push(...DB_ENV_VAR_NAMES.redis);
      redisSource = 'managed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(`Failed to attach a redis database: ${message}`);
      return false;
    }
  }

  const spinner = p.spinner();
  spinner.start(`Enabling background workers for ${ctx.environment.name}...`);

  try {
    await enableBackgroundWorkers(ctx.token, ctx.orgId, ctx.projectId, ctx.environment.id, redisSource);
    spinner.stop(`Background workers are enabled for ${ctx.environment.name}.`);
    state.backgroundWorkersEnabled = true;
    return true;
  } catch (error) {
    spinner.stop('Could not enable background workers.');
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Failed to enable background workers: ${message}`);
    return false;
  }
}

function cancelDeploy(): never {
  p.cancel('Deploy cancelled.');
  process.exit(0);
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
    spinner.stop(`Database "${ready.name}" is ready and attached to ${ctx.environment.slug}.`);
    return ready;
  } catch (error) {
    spinner.stop('Provisioning failed.');
    throw error;
  }
}
