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
    .argument('[vars...]', 'Variables to set, as KEY=VALUE, or bare KEY names to change only their kind')
    .option('--project <project>', 'Project name, slug, or ID (default: linked project)')
    .option('--secret', 'Store every variable in the command as a secret: write-only, delivered at boot')
    .option('--config', 'Store every variable in the command as config: readable, stored on the provider')
    .action(wrapAction(envVarsSetAction));
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

  const env = findEnvironment(environments, envArg);
  if (!env) {
    throw new Error(`Environment not found: ${envArg}`);
  }
  return env;
}

function findEnvironment(environments: Environment[], envArg: string): Environment | undefined {
  return environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);
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
  const vars: Record<string, string> = Object.create(null);
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

type EnvVarKind = 'secret' | 'config';

interface ParsedVarArgs {
  /** New values from `KEY=VALUE` arguments. */
  values: Record<string, string>;
  /** Bare `KEY` arguments (kind-only changes), with their 1-based argument position. */
  bareNames: { name: string; position: number }[];
}

/**
 * Parse `KEY=VALUE` and bare `KEY` arguments. An argument may be a pasted
 * value (base64 values end in "="), so errors refer to arguments by position
 * and never echo their text.
 */
function parseVarArgs(args: string[], kind: EnvVarKind | undefined): ParsedVarArgs {
  const values: Record<string, string> = Object.create(null);
  const bareNames: ParsedVarArgs['bareNames'] = [];
  for (const [index, arg] of args.entries()) {
    const position = index + 1;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      if (!kind) {
        throw new Error(
          `Expected KEY=VALUE for variable argument ${position}. A bare name needs --secret or --config.`,
        );
      }
      if (!ENV_VAR_NAME.test(arg)) {
        throw new Error(`Invalid variable name in argument ${position}`);
      }
      bareNames.push({ name: arg, position });
      continue;
    }
    const name = arg.slice(0, eq);
    if (!ENV_VAR_NAME.test(name)) {
      throw new Error(`Invalid variable name in argument ${position}`);
    }
    const value = arg.slice(eq + 1);
    if (isSecretPlaceholder(value)) {
      throw new Error(`Argument ${position} has a reserved placeholder value. Pass the real value.`);
    }
    values[name] = value;
  }
  return { values, bareNames };
}

/**
 * Set env vars on an environment and/or choose their kind.
 *
 * Secrets are write-only: the platform encrypts them and only delivers them
 * to the deployed service at boot. Config vars stay readable and are stored
 * on the provider. `--secret`/`--config` apply to every variable in the
 * command and send `envVarMeta` flags for them; vars not in the command keep
 * their stored kind. Bare `KEY` arguments change only the kind.
 *
 * The platform replaces the whole env map on save, so the stored vars are
 * sent back with the new values merged in. Write-only secrets come back as a
 * placeholder, which the platform reads as "keep the stored value".
 */
export async function envVarsSetAction(
  envArg: string | undefined,
  varArgs: string[],
  options: { project?: string; secret?: boolean; config?: boolean },
): Promise<void> {
  if (options.secret && options.config) {
    throw new Error('Pass either --secret or --config, not both. Set mixed kinds with separate commands.');
  }
  const kind: EnvVarKind | undefined = options.secret ? 'secret' : options.config ? 'config' : undefined;
  if (envArg === undefined && varArgs.length === 0) {
    throw new Error('Nothing to set. Pass KEY=VALUE pairs, or variable names with --secret or --config.');
  }

  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);
  const { environments, envVarsAuthority } = await fetchEnvironmentList(token, orgId, project.id);

  // `[environment]` is optional, so the first variable can land in its slot.
  // It's the environment only when it names one.
  const namedEnvironment = envArg === undefined ? undefined : findEnvironment(environments, envArg);
  const args = envArg !== undefined && !namedEnvironment ? [envArg, ...varArgs] : varArgs;
  const { values, bareNames } = parseVarArgs(args, kind);
  if (Object.keys(values).length === 0 && bareNames.length === 0) {
    throw new Error('Nothing to set. Pass KEY=VALUE pairs, or variable names with --secret or --config.');
  }

  const environment = namedEnvironment ?? pickEnvironment(environments, undefined, 'set');
  if (envVarsAuthority === 'project') {
    throw new Error(
      `${environment.slug} still reads env vars from the legacy project settings. Set them in the Mastra dashboard.`,
    );
  }

  const stored = environment.envVars ?? {};
  for (const { name, position } of bareNames) {
    if (!Object.hasOwn(stored, name) && !Object.hasOwn(values, name)) {
      throw new Error(`The variable in argument ${position} is not set on ${environment.slug}. Pass it as KEY=VALUE.`);
    }
    if (kind === 'config' && isSecretPlaceholder(stored[name]) && !Object.hasOwn(values, name)) {
      throw new Error(
        `The variable in argument ${position} is a write-only secret, so its value can't be kept as config. Re-enter it as KEY=VALUE with --config.`,
      );
    }
  }

  const changedNames = Object.keys(values);
  const kindNames = [...new Set([...changedNames, ...bareNames.map(({ name }) => name)])];
  const envVarMeta: Record<string, { secret: boolean }> = Object.create(null);
  if (kind) {
    for (const name of kindNames) envVarMeta[name] = { secret: kind === 'secret' };
  }

  await updateEnvironmentVars(token, orgId, project.id, environment.id, {
    ...(changedNames.length > 0 ? { envVars: { ...stored, ...values } } : {}),
    ...(kind ? { envVarMeta } : {}),
  });

  const parts: string[] = [];
  if (changedNames.length > 0) parts.push(`set ${[...changedNames].sort().join(', ')}`);
  if (kind) parts.push(`${kind}: ${[...kindNames].sort().join(', ')}`);
  console.info(`\n  Updated ${environment.slug} (${parts.join('; ')}).`);
  console.info('  Redeploy or run `mastra env restart` to apply.\n');
}
