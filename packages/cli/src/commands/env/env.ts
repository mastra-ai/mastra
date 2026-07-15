import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { wrapAction } from '../utils.js';
import type { Environment, EnvironmentDeploy } from './platform-api.js';
import {
  fetchEnvironments,
  fetchEnvironmentDeploys,
  createEnvironment,
  deleteEnvironment,
  restartEnvironment,
} from './platform-api.js';
import { resolveProject } from './resolve-project.js';
import { registerEnvVarsCommands } from './vars.js';

/**
 * Shape returned by `mastra env list --json` and `mastra env create --json`.
 *
 * The platform API response can include sensitive fields such as `envVars`
 * (raw environment variable values). We deliberately return only
 * non-sensitive metadata here so CLI JSON output — which frequently ends up
 * in CI logs, shell history, and pipeline artifacts — cannot leak secrets.
 */
type PublicEnvironment = Pick<
  Environment,
  | 'id'
  | 'projectId'
  | 'name'
  | 'slug'
  | 'type'
  | 'region'
  | 'branch'
  | 'instanceUrl'
  | 'customServerUrl'
  | 'managedEnvVarNames'
  | 'createdAt'
  | 'updatedAt'
>;

function toPublicEnvironment(env: Environment): PublicEnvironment {
  return {
    id: env.id,
    projectId: env.projectId,
    name: env.name,
    slug: env.slug,
    type: env.type,
    region: env.region,
    branch: env.branch,
    instanceUrl: env.instanceUrl,
    customServerUrl: env.customServerUrl,
    // Names only — never values. Safe for CI logs.
    managedEnvVarNames: env.managedEnvVarNames ?? [],
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
  };
}

/**
 * Pick the deploy that best represents "what is live" for an environment:
 * the newest deploy, preferring one that is actually serving traffic.
 */
export function latestDeployByEnvironment(deploys: EnvironmentDeploy[]): Map<string, EnvironmentDeploy> {
  const byCreatedAtDesc = [...deploys].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const latest = new Map<string, EnvironmentDeploy>();
  for (const deploy of byCreatedAtDesc) {
    if (!latest.has(deploy.environmentId)) {
      latest.set(deploy.environmentId, deploy);
    }
  }
  return latest;
}

export function isActiveDeployStatus(status: EnvironmentDeploy['status']): boolean {
  return status === 'running' || status === 'sleeping';
}

const PROJECT_OPTION = ['--project <project>', 'Project name, slug, or ID (default: linked project)'] as const;

export function registerEnvCommands(program: Command): Command {
  const env = program.command('env').description('Manage environments');

  env
    .command('list')
    .description("List the project's environments")
    .option(...PROJECT_OPTION)
    .option('--json', 'Output as JSON')
    .action(wrapAction(listEnvironmentsAction));

  env
    .command('create')
    .description('Create a new environment')
    .argument('<name>', 'Environment name (e.g., staging, preview)')
    .option(...PROJECT_OPTION)
    .option('-t, --type <type>', 'Environment type (production, staging, preview)', 'staging')
    .option('-r, --region <region>', 'Region for the environment (e.g., us, eu)')
    .option('--json', 'Output as JSON')
    .action(wrapAction(createEnvironmentAction));

  env
    .command('delete')
    .description('Delete an environment')
    .argument('<environment>', 'Environment name, slug, or ID')
    .option(...PROJECT_OPTION)
    .option('-y, --yes', 'Skip confirmation')
    .action(wrapAction(deleteEnvironmentAction));

  env
    .command('restart')
    .description("Restart an environment's running service so saved env vars take effect immediately")
    .argument('<environment>', 'Environment name, slug, or ID')
    .option(...PROJECT_OPTION)
    .action(wrapAction(restartEnvironmentAction));

  env
    .command('deploys')
    .description('List deploys across environments (filtered when an environment is given)')
    .argument('[environment]', 'Environment name, slug, or ID (omit to show all environments)')
    .option(...PROJECT_OPTION)
    .option('--json', 'Output as JSON')
    .action(wrapAction(listDeploysAction));

  // Env vars: mastra env vars ...
  registerEnvVarsCommands(env);

  return env;
}

async function listEnvironmentsAction(options?: { project?: string; json?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await resolveProject(token, orgId, options?.project);
  const [environments, deploys] = await Promise.all([
    fetchEnvironments(token, orgId, project.id),
    fetchEnvironmentDeploys(token, orgId, project.id),
  ]);
  const latestDeploys = latestDeployByEnvironment(deploys);

  if (options?.json) {
    const safeEnvironments = environments.map(env => {
      const deploy = latestDeploys.get(env.id);
      return {
        ...toPublicEnvironment(env),
        activeDeploy: deploy
          ? {
              id: deploy.id,
              status: deploy.status,
              active: isActiveDeployStatus(deploy.status),
              createdAt: deploy.createdAt,
            }
          : null,
      };
    });
    process.stdout.write(`${JSON.stringify({ environments: safeEnvironments }, null, 2)}\n`);
    return;
  }

  console.info(`\nEnvironments for ${project.name}:\n`);

  if (environments.length === 0) {
    console.info('  No environments yet. Create one with: mastra env create <name>\n');
    return;
  }

  for (const env of environments) {
    const url = env.instanceUrl || env.customServerUrl || '';
    console.info(`  ${env.name} [${env.type}]`);
    console.info(`    Slug: ${env.slug}`);
    console.info(`    ID: ${env.id}`);
    if (url) {
      console.info(`    URL: ${url}`);
    }
    if (env.customServerUrl) {
      console.info(`    Custom Server: ${env.customServerUrl}`);
    }
    const deploy = latestDeploys.get(env.id);
    if (deploy) {
      const marker = isActiveDeployStatus(deploy.status) ? ' (active)' : '';
      console.info(`    Deploy: ${deploy.id} — ${deploy.status}${marker}`);
    } else {
      console.info(`    Deploy: none`);
    }
    if (env.managedEnvVarNames && env.managedEnvVarNames.length > 0) {
      console.info(`    Managed env vars: ${env.managedEnvVarNames.join(', ')}`);
    }
  }
  console.info('');
}

async function listDeploysAction(envArg: string | undefined, options?: { project?: string; json?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await resolveProject(token, orgId, options?.project);
  let deploys = await fetchEnvironmentDeploys(token, orgId, project.id);

  if (envArg) {
    const environments = await fetchEnvironments(token, orgId, project.id);
    const env = environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);
    if (!env) {
      console.error(`error: environment not found: ${envArg}`);
      process.exit(1);
    }
    deploys = deploys.filter(d => d.environmentId === env.id);
  }

  const sorted = [...deploys].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  if (options?.json) {
    const safeDeploys = sorted.map(d => ({
      id: d.id,
      environmentId: d.environmentId,
      environmentName: d.environmentName,
      environmentSlug: d.environmentSlug,
      status: d.status,
      active: isActiveDeployStatus(d.status),
      instanceUrl: d.instanceUrl,
      error: d.error,
      createdAt: d.createdAt,
      githubBranch: d.githubBranch,
      githubCommitSha: d.githubCommitSha,
    }));
    process.stdout.write(`${JSON.stringify({ deploys: safeDeploys }, null, 2)}\n`);
    return;
  }

  console.info(`\nDeploys for ${project.name}:\n`);

  if (sorted.length === 0) {
    console.info('  No deploys yet. Deploy with: mastra deploy\n');
    return;
  }

  for (const deploy of sorted) {
    const marker = isActiveDeployStatus(deploy.status) ? ' (active)' : '';
    console.info(`  ${deploy.id} — ${deploy.status}${marker}`);
    console.info(`    Environment: ${deploy.environmentSlug} (${deploy.environmentName})`);
    if (deploy.createdAt) {
      console.info(`    Created: ${deploy.createdAt}`);
    }
    if (deploy.instanceUrl) {
      console.info(`    URL: ${deploy.instanceUrl}`);
    }
    if (deploy.error) {
      console.info(`    Error: ${deploy.error}`);
    }
  }
  console.info('');
}

async function createEnvironmentAction(
  name: string,
  options: { project?: string; type?: string; region?: string; json?: boolean },
) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await resolveProject(token, orgId, options.project);
  const type = (options.type || 'staging') as 'production' | 'staging' | 'preview';

  const environment = await createEnvironment(token, orgId, project.id, {
    name,
    type,
    ...(options.region ? { region: options.region } : {}),
  });

  if (options.json) {
    const safeEnvironment = toPublicEnvironment(environment);
    process.stdout.write(`${JSON.stringify({ environment: safeEnvironment }, null, 2)}\n`);
    return;
  }

  console.info(`\nCreated environment: ${environment.name}`);
  console.info(`  Slug: ${environment.slug}`);
  console.info(`  ID: ${environment.id}`);
  console.info(`  Type: ${environment.type}\n`);
}

async function restartEnvironmentAction(envArg: string, options?: { project?: string }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await resolveProject(token, orgId, options?.project);
  const environments = await fetchEnvironments(token, orgId, project.id);
  const env = environments.find(e => e.id === envArg || e.name === envArg || e.slug === envArg);

  if (!env) {
    console.error(`error: environment not found: ${envArg}`);
    process.exit(1);
  }

  const spinner = p.spinner();
  spinner.start(`Restarting ${env.slug}...`);
  try {
    await restartEnvironment(token, orgId, project.id, env.id);
  } catch (err) {
    spinner.stop('Restart failed.');
    throw err;
  }
  spinner.stop(`Restarted ${env.slug}. Saved env vars are now live.`);
}

async function deleteEnvironmentAction(envArg: string, options?: { project?: string; yes?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await resolveProject(token, orgId, options?.project);
  const environments = await fetchEnvironments(token, orgId, project.id);

  if (environments.length === 0) {
    console.error('error: no environments to delete');
    process.exit(1);
  }

  const env = environments.find(
    (e: { id: string; name: string; slug: string }) => e.id === envArg || e.name === envArg || e.slug === envArg,
  );

  if (!env) {
    console.error(`error: environment not found: ${envArg}`);
    process.exit(1);
  }

  if (!options?.yes) {
    const confirm = await p.confirm({
      message: `Delete environment "${env.name}" (${env.slug})?`,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
  }

  await deleteEnvironment(token, orgId, project.id, env.id);
  console.info('Environment deleted.');
}
