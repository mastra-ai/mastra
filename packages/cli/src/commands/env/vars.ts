import { chmod, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Command } from 'commander';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { getServerProjectEnv } from '../server/platform-api.js';
import { wrapAction } from '../utils.js';
import { serializeEnvFile } from './env-file.js';
import type { Environment } from './platform-api.js';
import { fetchEnvironmentList, isSecretPlaceholder, updateEnvironmentVars } from './platform-api.js';
import { resolveProject } from './resolve-project.js';

/** Register the `mastra env vars ...` subcommands on the given `env` command. */
export function registerEnvVarsCommands(env: Command): void {
  const vars = env.command('vars').description("Manage an environment's variables");

  vars
    .command('pull')
    .description('Pull the env vars an environment deploys with into a local env file')
    .argument('[environment]', 'Environment name, slug, or ID (optional when the project has exactly one)')
    .option('--project <project>', 'Project name, slug, or ID (default: linked project)')
    .option('-o, --output <file>', 'File to write (default: .env)')
    .option('-f, --force', 'Overwrite an existing output file')
    .action(wrapAction(envVarsPullAction));

  vars
    .command('set')
    .description('Set env vars on an environment and choose whether each is a secret or config')
    .argument('[environment]', 'Environment name, slug, or ID (optional when the project has exactly one)')
    .argument('[vars...]', 'Variables to set, as KEY=VALUE')
    .option('--project <project>', 'Project name, slug, or ID (default: linked project)')
    .option('--secret <key>', 'Store KEY as a secret: write-only, delivered at boot (repeatable)', collect, [])
    .option('--config <key>', 'Store KEY as config: readable, stored on the provider (repeatable)', collect, [])
    .action(wrapAction(envVarsSetAction));
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** True when a filesystem error means the target path already exists (`EEXIST`). */
function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

/**
 * Resolve the environment to pull by id, name, or slug. When no argument is
 * given the project must have exactly one environment; otherwise the error
 * lists the available slugs.
 */
function pickEnvironment(environments: Environment[], envArg: string | undefined, command: string): Environment {
  if (environments.length === 0) {
    throw new Error('No environments found for this project. Deploy first with `mastra deploy`.');
  }

  if (!envArg) {
    if (environments.length === 1) return environments[0]!;
    const slugs = environments.map(e => e.slug).join(', ');
    throw new Error(`Multiple environments found (${slugs}). Specify one: mastra env vars ${command} <environment>`);
  }

  const env = environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);
  if (!env) {
    // `set` may get a pasted value in the environment slot, so don't echo it there.
    if (command === 'set') {
      throw new Error(`Environment not found. Available: ${environments.map(e => e.slug).join(', ')}`);
    }
    throw new Error(`Environment not found: ${envArg}`);
  }
  return env;
}

/**
 * Pull the env vars a deploy of the target environment actually runs with.
 *
 * The platform reports which store the runtime reads from
 * (`envVarsAuthority` on the environments list):
 *
 * - `environment` (every project adopted onto environments): the selected
 *   environment row's own vars. Nothing else is merged in. The legacy
 *   project-scope endpoint (`GET /v1/server/projects/:id/env`) is NOT
 *   consulted here because, for env-first projects, the platform answers it
 *   with the *production* environment's vars. Merging that in used to make
 *   `mastra env vars pull qa` write production's values for every key the
 *   two environments share.
 * - `project` (legacy, not yet adopted): the runtime still boots from the
 *   project row, so that is what gets pulled. Environment rows exist but
 *   nothing reads their vars.
 *
 * Managed vars (platform-injected secrets) and write-only secrets are listed
 * as comments, names only.
 */
export async function envVarsPullAction(
  envArg: string | undefined,
  options: { project?: string; output?: string; force?: boolean },
): Promise<void> {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const { environments, envVarsAuthority } = await fetchEnvironmentList(token, orgId, project.id);
  const environment = pickEnvironment(environments, envArg, 'pull');

  const pulled =
    envVarsAuthority === 'project' ? await getServerProjectEnv(token, orgId, project.id) : (environment.envVars ?? {});

  // Write-only secrets come back as a placeholder, not their value. Writing
  // the placeholder would put a value in the file that looks real but isn't.
  const vars: Record<string, string> = {};
  const secretVarNames: string[] = [];
  for (const [name, value] of Object.entries(pulled)) {
    if (isSecretPlaceholder(value)) secretVarNames.push(name);
    else vars[name] = value;
  }

  const { content, written, skipped } = serializeEnvFile(vars, {
    header: `Pulled from Mastra environment ${environment.slug} — do not edit manually`,
    managedVarNames: environment.managedEnvVarNames,
    secretVarNames,
  });

  const target = options.output ?? '.env';
  const outputPath = resolve(target);
  try {
    await writeFile(outputPath, content, {
      encoding: 'utf-8',
      mode: 0o600,
      flag: options.force ? 'w' : 'wx',
    });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      throw new Error(`Refusing to overwrite ${target}. Re-run with --force to replace it.`);
    }
    throw error;
  }
  await chmod(outputPath, 0o600);

  if (written === 0 && secretVarNames.length === 0) {
    console.info(`\n  No env vars set on ${environment.slug}. Wrote empty ${target}.\n`);
  } else {
    console.info(
      `\n  Pulled ${written} variable(s) from ${environment.slug} to ${target}.${skipped > 0 ? ` Skipped ${skipped} unsafe key(s).` : ''}\n`,
    );
  }
  if (secretVarNames.length > 0) {
    console.info(
      `  ${secretVarNames.length} secret name(s) listed as comments — secrets are write-only and delivered at boot.\n`,
    );
  }
  const managedCount = environment.managedEnvVarNames?.length ?? 0;
  if (managedCount > 0) {
    console.info(
      `  ${managedCount} managed variable name(s) listed as comments — values are injected at deploy time.\n`,
    );
  }
}

const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse `KEY=VALUE` arguments. Values are never echoed back in errors. */
function parseAssignments(args: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [index, arg] of args.entries()) {
    const eq = arg.indexOf('=');
    // A malformed argument may be a pasted value (base64 values end in "="), so refer to it by position only.
    if (eq === -1) {
      throw new Error(`Expected KEY=VALUE for variable argument ${index + 1}`);
    }
    const name = arg.slice(0, eq);
    if (!ENV_VAR_NAME.test(name)) {
      throw new Error(`Invalid variable name in argument ${index + 1}`);
    }
    const value = arg.slice(eq + 1);
    if (isSecretPlaceholder(value)) {
      throw new Error(`${name} has a reserved placeholder value. Pass the real value.`);
    }
    vars[name] = value;
  }
  return vars;
}

/**
 * Set env vars on an environment and/or choose their kind.
 *
 * Secrets are write-only: the platform encrypts them and only delivers them
 * to the deployed service at boot. Config vars stay readable and are stored
 * on the provider. `--secret`/`--config` send `envVarMeta` flags for the named
 * vars; vars not named keep their stored kind.
 *
 * The platform replaces the whole env map on save, so the stored vars are
 * sent back with the new values merged in. Write-only secrets come back as a
 * placeholder, which the platform reads as "keep the stored value".
 */
export async function envVarsSetAction(
  envArg: string | undefined,
  assignments: string[],
  options: { project?: string; secret?: string[]; config?: string[] },
): Promise<void> {
  // `[environment]` is optional, so a lone `KEY=VALUE` lands there.
  const args = envArg?.includes('=') ? [envArg, ...assignments] : assignments;
  const environmentArg = envArg?.includes('=') ? undefined : envArg;
  const newVars = parseAssignments(args);
  const secretNames = options.secret ?? [];
  const configNames = options.config ?? [];

  for (const name of [...secretNames, ...configNames]) {
    if (!ENV_VAR_NAME.test(name)) {
      throw new Error(`Invalid env var name: ${name.replace(/[^\w.-]/g, '?')}`);
    }
  }
  const both = secretNames.filter(name => configNames.includes(name));
  if (both.length > 0) {
    throw new Error(`Cannot mark a var as both --secret and --config: ${both.join(', ')}`);
  }
  if (Object.keys(newVars).length === 0 && secretNames.length === 0 && configNames.length === 0) {
    throw new Error('Nothing to set. Pass KEY=VALUE pairs and/or --secret <key> / --config <key>.');
  }

  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const { environments, envVarsAuthority } = await fetchEnvironmentList(token, orgId, project.id);
  const environment = pickEnvironment(environments, environmentArg, 'set');
  if (envVarsAuthority === 'project') {
    throw new Error(
      `${environment.slug} still reads env vars from the legacy project settings. Set them in the Mastra dashboard.`,
    );
  }

  const stored = environment.envVars ?? {};
  for (const name of [...secretNames, ...configNames]) {
    if (!Object.hasOwn(stored, name) && !Object.hasOwn(newVars, name)) {
      throw new Error(`${name} is not set on ${environment.slug}. Pass a value: ${name}=...`);
    }
  }
  for (const name of configNames) {
    if (isSecretPlaceholder(stored[name]) && !Object.hasOwn(newVars, name)) {
      throw new Error(
        `${name} is a write-only secret, so its value can't be kept as config. Re-enter it: ${name}=... --config ${name}`,
      );
    }
  }

  const envVarMeta: Record<string, { secret: boolean }> = {};
  for (const name of secretNames) envVarMeta[name] = { secret: true };
  for (const name of configNames) envVarMeta[name] = { secret: false };

  const changedNames = Object.keys(newVars);
  await updateEnvironmentVars(token, orgId, project.id, environment.id, {
    ...(changedNames.length > 0 ? { envVars: { ...stored, ...newVars } } : {}),
    ...(Object.keys(envVarMeta).length > 0 ? { envVarMeta } : {}),
  });

  const parts: string[] = [];
  if (changedNames.length > 0) parts.push(`set ${changedNames.sort().join(', ')}`);
  if (secretNames.length > 0) parts.push(`secret: ${[...secretNames].sort().join(', ')}`);
  if (configNames.length > 0) parts.push(`config: ${[...configNames].sort().join(', ')}`);
  console.info(`\n  Updated ${environment.slug} (${parts.join('; ')}).`);
  console.info('  Redeploy or run `mastra env restart` to apply.\n');
}
