import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import type { Environment, Project } from '../env/platform-api.js';
import { fetchEnvironments } from '../env/platform-api.js';
import { resolveProject } from '../env/resolve-project.js';
import { wrapAction } from '../utils.js';
import type { DatabaseKind, ProjectDatabase } from './platform-api.js';
import {
  attachDatabase,
  DB_ENV_VAR_NAMES,
  deleteDatabase,
  fetchDatabase,
  fetchDatabaseConnection,
  fetchDatabases,
  pollDatabaseUntilReady,
} from './platform-api.js';

const PROJECT_OPTION = ['--project <project>', 'Project name, slug, or ID (default: linked project)'] as const;

export function registerEnvDbCommands(envCommand: Command) {
  const db = envCommand.command('db').description('Manage databases attached to a project and its environments');

  db.command('list')
    .description('List databases and which environment each one feeds (filtered when an environment is given)')
    .argument('[environment]', 'Environment name, slug, or ID (default: all databases)')
    .option(...PROJECT_OPTION)
    .option('--json', 'Output as JSON')
    .action(wrapAction(listDatabasesAction));

  db.command('create')
    .description('Provision a database, attach it, and wait until it is ready')
    .argument(
      '[environment]',
      "Environment name, slug, or ID (default: the project's only environment, or prompt if there are several)",
    )
    .requiredOption('--kind <kind>', 'Database provider (turso, neon)')
    .option(...PROJECT_OPTION)
    .option('--name <name>', 'Database name (default: derived from the project slug)')
    .option('--region <region>', 'Provider region ID (shared databases only; environment region wins otherwise)')
    .option('--shared', 'Attach as a project-scoped database shared by all environments')
    .option('--no-wait', 'Return immediately instead of polling until the database is ready')
    .option('--json', 'Output as JSON')
    .action(wrapAction(createDatabaseAction));

  db.command('show')
    .description('Show database details and connection instructions')
    .argument('<database>', 'Database ID or name')
    .option(...PROJECT_OPTION)
    .option('--show-secrets', 'Print secret connection values instead of masking them')
    .option('--json', 'Output as JSON')
    .action(wrapAction(showDatabaseAction));

  db.command('delete')
    .description('Permanently delete a database and all its data (admin only)')
    .argument('<database>', 'Database ID or name')
    .option(...PROJECT_OPTION)
    .option('-y, --yes', 'Skip confirmation')
    .action(wrapAction(deleteDatabaseAction));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Human-readable attachment scope: which environment(s) receive this
 * database's env vars.
 */
export function formatScope(db: Pick<ProjectDatabase, 'environmentId'>, environments: Environment[]): string {
  if (!db.environmentId) {
    return 'project (all environments)';
  }
  const env = environments.find(e => e.id === db.environmentId);
  return env ? `environment: ${env.slug}` : `environment: ${db.environmentId}`;
}

/**
 * Derive a provider-safe default database name from the project slug/name,
 * optionally suffixed with an environment discriminator for env-scoped
 * attaches.
 *
 * Turso names become DNS labels, so: lowercase letters, digits, hyphens,
 * no leading/trailing hyphen, max 64 chars.
 *
 * When `environment` is provided and its type is not `production`, the name
 * includes an env-derived suffix (e.g. `my-app-eu-db`). Two env-scoped
 * databases in the same project must have different names — the platform
 * rejects duplicates — so the suffix is essential for auto-provisioning
 * across environments. The `production` env is treated as the canonical
 * default and stays unsuffixed so existing single-env projects keep the
 * clean `<project>-db` name.
 *
 * We identify production by `environment.type`, not by name/slug matching,
 * because users are free to rename their production env to `main`, `live`,
 * etc., and a non-prod env named `production` should still be suffixed.
 *
 * If the resulting name would exceed 64 chars, we truncate the *project*
 * segment rather than the tail — otherwise `slice(0, 64)` would eat the
 * env discriminator and re-create the collision this function exists to
 * prevent.
 */
const MAX_DB_NAME_LEN = 64;
const DB_NAME_TAIL = '-db';

export function defaultDatabaseName(
  project: Pick<Project, 'name' | 'slug'>,
  environment?: Pick<Environment, 'name' | 'slug' | 'type'> | null,
): string {
  const projectPart = sanitizeSegment(project.slug || project.name) || 'mastra';

  const shouldSuffix = Boolean(environment) && environment!.type !== 'production';
  // Prefer the env name over the slug: platforms sometimes derive the
  // production env's slug from the project name (e.g. `smoke-envdbux-1784317673`),
  // which would produce ugly `<project>-<project>-db` duplication.
  const envPart = shouldSuffix ? sanitizeSegment(environment!.name || environment!.slug || '') : '';

  if (!envPart) {
    return truncateToMax(projectPart) + DB_NAME_TAIL;
  }

  // Reserve room for `-<envPart>-db` and truncate the project segment first
  // so the discriminator survives. `slice(0, 64)` on the full string would
  // eat the tail — losing the very thing that keeps names distinct across
  // environments (issue: same project, different envs → identical truncated
  // name → duplicate rejected by the platform).
  const separatorLen = 1; // '-' between project and env
  const overhead = separatorLen + envPart.length + DB_NAME_TAIL.length;
  let projectRoom = MAX_DB_NAME_LEN - overhead;
  let envSegment = envPart;
  if (projectRoom < 1) {
    // Extreme case: env name alone eats the whole budget. Give the project
    // segment 1 char (always keep some project context) and clamp the env
    // to what remains — but keep at least 1 char of env so the discriminator
    // survives.
    projectRoom = 1;
    const envRoom = MAX_DB_NAME_LEN - projectRoom - separatorLen - DB_NAME_TAIL.length;
    envSegment = envPart.slice(0, Math.max(1, envRoom));
  }
  const projectSegment = truncateToMax(projectPart, projectRoom) || projectPart.slice(0, 1);
  return `${projectSegment}-${envSegment}${DB_NAME_TAIL}`;
}

/**
 * Truncate an already-sanitized segment to at most `max` chars, dropping any
 * trailing hyphens produced by the cut so the result is still a valid DNS
 * label fragment.
 */
function truncateToMax(segment: string, max: number = MAX_DB_NAME_LEN - DB_NAME_TAIL.length): string {
  if (max < 1) return '';
  return segment.slice(0, max).replace(/-+$/g, '');
}

function sanitizeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function envVarNamesFor(kind: DatabaseKind): string {
  const names = DB_ENV_VAR_NAMES[kind] ?? [];
  return names.length > 0 ? names.join(', ') : '—';
}

function withScope(db: ProjectDatabase, environments: Environment[]) {
  return {
    ...db,
    scope: formatScope(db, environments),
    envVarNames: DB_ENV_VAR_NAMES[db.kind] ?? [],
  };
}

async function findDatabase(token: string, orgId: string, project: Project, dbArg: string): Promise<ProjectDatabase> {
  const databases = await fetchDatabases(token, orgId, project.id);
  const db = databases.find(d => d.id === dbArg || d.name === dbArg);
  if (!db) {
    throw new Error(`Database not found: ${dbArg}. List databases with: mastra env db list`);
  }
  return db;
}

/* ------------------------------------------------------------------ */
/*  mastra env db list                                                 */
/* ------------------------------------------------------------------ */

async function findEnvironment(token: string, orgId: string, project: Project, envArg: string): Promise<Environment> {
  const environments = await fetchEnvironments(token, orgId, project.id);
  const env = environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);
  if (!env) {
    throw new Error(`Environment not found: ${envArg}. List environments with: mastra env list`);
  }
  return env;
}

async function listDatabasesAction(envArg: string | undefined, options: { project?: string; json?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const [databases, environments] = await Promise.all([
    fetchDatabases(token, orgId, project.id),
    fetchEnvironments(token, orgId, project.id),
  ]);

  const env = envArg
    ? (environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg) ??
      (() => {
        throw new Error(`Environment not found: ${envArg}. List environments with: mastra env list`);
      })())
    : undefined;

  // When filtering by environment, a database "feeds" it if it's scoped to
  // that environment or shared (project-scoped).
  const visible = env ? databases.filter(db => db.environmentId === env.id || !db.environmentId) : databases;

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ...(env ? { environment: env.slug } : {}),
          databases: visible.map(db => withScope(db, environments)),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  console.info(env ? `\nDatabases feeding ${env.slug}:\n` : `\nDatabases for ${project.name}:\n`);

  if (visible.length === 0) {
    console.info(
      `  No databases attached. Create one with: mastra env db create${env ? ` ${env.slug}` : ''} --kind turso\n`,
    );
    return;
  }

  for (const db of visible) {
    console.info(`  ${db.name} (${db.kind}) — ${db.status}`);
    console.info(`    ID: ${db.id}`);
    console.info(`    Scope: ${formatScope(db, environments)}`);
    if (db.region) {
      console.info(`    Region: ${db.region}`);
    }
    console.info(`    Env vars: ${envVarNamesFor(db.kind)}`);
    if (db.error) {
      console.info(`    Error: ${db.error}`);
    }
  }
  console.info('');
}

/* ------------------------------------------------------------------ */
/*  mastra env db create                                               */
/* ------------------------------------------------------------------ */

function parseKind(kind: string): DatabaseKind {
  if (kind !== 'turso' && kind !== 'neon') {
    throw new Error(`Unsupported database kind: ${kind}. Supported kinds: turso, neon`);
  }
  return kind;
}

async function createDatabaseAction(
  envArg: string | undefined,
  options: {
    project?: string;
    kind: string;
    name?: string;
    region?: string;
    shared?: boolean;
    wait: boolean;
    json?: boolean;
  },
) {
  const kind = parseKind(options.kind);

  if (envArg && options.shared) {
    throw new Error('Cannot combine an environment argument with --shared. Pick one scope.');
  }

  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const environment = options.shared
    ? undefined
    : envArg
      ? await findEnvironment(token, orgId, project, envArg)
      : await resolveDefaultEnvironment(token, orgId, project, { json: options.json });

  if (environment && options.region && !options.json) {
    console.info(`Note: --region is ignored for environment-scoped databases; the environment's region is used.`);
  }

  await createDatabase({
    token,
    orgId,
    project,
    environment,
    kind,
    name: options.name,
    regionId: options.region,
    wait: options.wait,
    json: options.json,
  });
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

/**
 * When the user runs `mastra env db create` without an environment argument
 * and without --shared, pick the environment to scope the new database to:
 *  - exactly one environment → use it
 *  - multiple environments + interactive TTY → prompt with a picker
 *  - multiple environments + non-interactive → fail with a clear message
 *  - zero environments → fail (nothing to attach to)
 */
export async function resolveDefaultEnvironment(
  token: string,
  orgId: string,
  project: Project,
  opts: { json?: boolean } = {},
): Promise<Environment> {
  const environments = await fetchEnvironments(token, orgId, project.id);

  if (environments.length === 0) {
    throw new Error(`Project ${project.name} has no environments. Create one with: mastra env create <name>`);
  }

  if (environments.length === 1) {
    return environments[0]!;
  }

  if (opts.json || !isInteractive()) {
    const slugs = environments.map(e => e.slug).join(', ');
    throw new Error(
      `Project ${project.name} has multiple environments (${slugs}). Pass an environment name (e.g. ` +
        `\`mastra env db create <env> --kind ...\`) or use --shared to attach a project-scoped database.`,
    );
  }

  // Prefer production as the pre-selected option when it exists.
  const preferred = environments.find(e => e.type === 'production') ?? environments[0]!;

  const selected = await p.select({
    message: 'Which environment should this database be scoped to?',
    initialValue: preferred.id,
    options: environments.map(e => ({
      value: e.id,
      label: `${e.slug} (${e.type})`,
      hint: e.region ?? undefined,
    })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return environments.find(e => e.id === selected)!;
}

async function createDatabase(opts: {
  token: string;
  orgId: string;
  project: Project;
  environment?: Environment;
  kind: DatabaseKind;
  name?: string;
  regionId?: string;
  wait: boolean;
  json?: boolean;
}) {
  const { token, orgId, project, environment, kind } = opts;
  const name = opts.name ?? defaultDatabaseName(project, environment);

  const created = await attachDatabase(token, orgId, project.id, {
    kind,
    name,
    ...(environment ? { environmentId: environment.id } : {}),
    ...(opts.regionId && !environment ? { regionId: opts.regionId } : {}),
  });

  const scopeLabel = environment ? `environment: ${environment.slug}` : 'project (shared by all environments)';

  if (!opts.wait) {
    if (opts.json) {
      process.stdout.write(`${JSON.stringify({ database: created, scope: scopeLabel }, null, 2)}\n`);
    } else {
      console.info(`\nDatabase ${created.name} (${created.kind}) is provisioning.`);
      console.info(`  ID: ${created.id}`);
      console.info(`  Scope: ${scopeLabel}`);
      console.info(`  Check progress with: mastra env db show ${created.id}\n`);
    }
    return;
  }

  let ready: ProjectDatabase;
  if (opts.json) {
    ready = await pollDatabaseUntilReady(token, orgId, project.id, created.id);
    process.stdout.write(`${JSON.stringify({ database: ready, scope: scopeLabel }, null, 2)}\n`);
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Provisioning ${created.kind} database "${created.name}"...`);
  try {
    ready = await pollDatabaseUntilReady(token, orgId, project.id, created.id, {
      onStatus: status => spinner.message(`Provisioning ${created.kind} database "${created.name}" — ${status}`),
    });
  } catch (error) {
    spinner.stop('Provisioning failed.');
    throw error;
  }
  spinner.stop(`Database "${ready.name}" is ready.`);

  console.info(`\n  ID: ${ready.id}`);
  console.info(`  Kind: ${ready.kind}`);
  console.info(`  Scope: ${scopeLabel}`);
  if (ready.region) {
    console.info(`  Region: ${ready.region}`);
  }
  console.info(`  Env vars injected at deploy time: ${envVarNamesFor(ready.kind)}`);
  console.info(`\n  Connection details: mastra env db show ${ready.id}\n`);
}

/* ------------------------------------------------------------------ */
/*  mastra env db show                                                 */
/* ------------------------------------------------------------------ */

async function showDatabaseAction(dbArg: string, options: { project?: string; showSecrets?: boolean; json?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const found = await findDatabase(token, orgId, project, dbArg);
  const [db, environments] = await Promise.all([
    fetchDatabase(token, orgId, project.id, found.id),
    fetchEnvironments(token, orgId, project.id),
  ]);

  const connection = db.status === 'ready' ? await fetchDatabaseConnection(token, orgId, project.id, db.id) : null;

  if (options.json) {
    const jsonConnection = connection
      ? {
          ...connection,
          envVars: connection.envVars.map(v => ({
            ...v,
            value: v.secret && !options.showSecrets ? '********' : v.value,
          })),
        }
      : null;
    process.stdout.write(
      `${JSON.stringify({ database: withScope(db, environments), connection: jsonConnection }, null, 2)}\n`,
    );
    return;
  }

  console.info(`\n${db.name} (${db.kind})`);
  console.info(`  ID: ${db.id}`);
  console.info(`  Status: ${db.status}`);
  console.info(`  Scope: ${formatScope(db, environments)}`);
  if (db.region) {
    console.info(`  Region: ${db.region}`);
  }
  console.info(`  Created: ${db.createdAt}`);
  if (db.error) {
    console.info(`  Error: ${db.error}`);
  }

  if (connection) {
    console.info('\n  Connection env vars (injected automatically at deploy time):');
    for (const envVar of connection.envVars) {
      const value = envVar.secret && !options.showSecrets ? '******** (use --show-secrets to reveal)' : envVar.value;
      console.info(`    ${envVar.name}=${value}`);
    }
    if (connection.docsUrl) {
      console.info(`\n  Docs: ${connection.docsUrl}`);
    }
  } else if (db.status === 'provisioning') {
    console.info('\n  Connection instructions become available once the database is ready.');
  }
  console.info('');
}

/* ------------------------------------------------------------------ */
/*  mastra env db delete                                               */
/* ------------------------------------------------------------------ */

async function deleteDatabaseAction(dbArg: string, options: { project?: string; yes?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const db = await findDatabase(token, orgId, project, dbArg);

  if (!options.yes) {
    const confirm = await p.confirm({
      message: `Permanently delete database "${db.name}" (${db.kind}) and ALL of its data? This cannot be undone. Deploys for ${project.name} will no longer receive its env vars.`,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
  }

  await deleteDatabase(token, orgId, project.id, db.id);
  console.info(`Database "${db.name}" deleted.`);
}
