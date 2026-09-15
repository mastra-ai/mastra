import { chmod, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Command } from 'commander';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { getServerProjectEnv } from '../server/platform-api.js';
import { wrapAction } from '../utils.js';
import { serializeEnvFile } from './env-file.js';
import type { Environment } from './platform-api.js';
import { fetchEnvironments } from './platform-api.js';
import { resolveProject } from './resolve-project.js';

export function registerEnvVarsCommands(env: Command): void {
  const vars = env.command('vars').description("Manage an environment's variables");

  vars
    .command('pull')
    .description('Pull the merged env vars (environment + project scope) into a local env file')
    .argument('[environment]', 'Environment name, slug, or ID (optional when the project has exactly one)')
    .option('--project <project>', 'Project name, slug, or ID (default: linked project)')
    .option('-o, --output <file>', 'File to write (default: .env)')
    .option('-f, --force', 'Overwrite an existing output file')
    .action(wrapAction(envVarsPullAction));
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

function pickEnvironment(environments: Environment[], envArg: string | undefined): Environment {
  if (environments.length === 0) {
    throw new Error('No environments found for this project. Deploy first with `mastra deploy`.');
  }

  if (!envArg) {
    if (environments.length === 1) return environments[0]!;
    const slugs = environments.map(e => e.slug).join(', ');
    throw new Error(`Multiple environments found (${slugs}). Specify one: mastra env vars pull <environment>`);
  }

  const env = environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);
  if (!env) {
    throw new Error(`Environment not found: ${envArg}`);
  }
  return env;
}

/**
 * Pull the full set of env vars that a deploy of the target environment
 * actually runs with — the environment row's vars (e.g. added via the UI
 * editor) merged with the project-scoped vars, with project values winning on
 * conflict, matching the platform's deploy-time merge precedence. Managed
 * vars (platform-injected secrets) are listed as comments, names only.
 *
 * The legacy `mastra server env pull` reads only the project scope; this is
 * the unified-surface replacement that fixes UI-added vars silently missing
 * from pulled files.
 */
export async function envVarsPullAction(
  envArg: string | undefined,
  options: { project?: string; output?: string; force?: boolean },
): Promise<void> {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, options.project);

  const [environments, projectVars] = await Promise.all([
    fetchEnvironments(token, orgId, project.id),
    getServerProjectEnv(token, orgId, project.id),
  ]);
  const environment = pickEnvironment(environments, envArg);

  // Same precedence as the platform's deploy-time merge: environment row
  // vars first, project-scoped vars override on conflict.
  const merged = { ...(environment.envVars ?? {}), ...projectVars };

  const { content, written, skipped } = serializeEnvFile(merged, {
    header: `Pulled from Mastra environment ${environment.slug} — do not edit manually`,
    managedVarNames: environment.managedEnvVarNames,
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

  if (written === 0) {
    console.info(`\n  No env vars set on ${environment.slug}. Wrote empty ${target}.\n`);
  } else {
    console.info(
      `\n  Pulled ${written} variable(s) from ${environment.slug} to ${target}.${skipped > 0 ? ` Skipped ${skipped} unsafe key(s).` : ''}\n`,
    );
  }
  const managedCount = environment.managedEnvVarNames?.length ?? 0;
  if (managedCount > 0) {
    console.info(
      `  ${managedCount} managed variable name(s) listed as comments — values are injected at deploy time.\n`,
    );
  }
}
