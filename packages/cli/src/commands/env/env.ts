import { Command } from 'commander';
import * as p from '@clack/prompts';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { fetchProjects, fetchEnvironments, createEnvironment, deleteEnvironment } from './platform-api.js';

export function registerEnvCommands(program: Command) {
  const env = program.command('env').description('Manage environments');

  env
    .command('list')
    .description('List environments for a project')
    .argument('<project>', 'Project name, slug, or ID')
    .option('--json', 'Output as JSON')
    .action(listEnvironmentsAction);

  env
    .command('create')
    .description('Create a new environment')
    .argument('<project>', 'Project name, slug, or ID')
    .requiredOption('-n, --name <name>', 'Environment name (e.g., staging, preview)')
    .option('-t, --type <type>', 'Environment type (production, staging, preview)', 'staging')
    .option('--json', 'Output as JSON')
    .action(createEnvironmentAction);

  env
    .command('delete')
    .description('Delete an environment')
    .argument('<project>', 'Project name, slug, or ID')
    .argument('<environment>', 'Environment name, slug, or ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(deleteEnvironmentAction);
}

async function findProject(token: string, orgId: string, projectArg: string) {
  const projects = await fetchProjects(token, orgId);

  if (projects.length === 0) {
    console.error('error: no projects found. Create one with: mastra studio projects create');
    process.exit(1);
  }

  const project = projects.find(
    (proj: { id: string; name: string; slug: string | null }) =>
      proj.id === projectArg || proj.name === projectArg || proj.slug === projectArg,
  );

  if (!project) {
    console.error(`error: project not found: ${projectArg}`);
    process.exit(1);
  }

  return project;
}

async function listEnvironmentsAction(projectArg: string, options?: { json?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await findProject(token, orgId, projectArg);
  const environments = await fetchEnvironments(token, orgId, project.id);

  if (options?.json) {
    console.log(JSON.stringify({ environments }, null, 2));
    return;
  }

  console.info(`\nEnvironments for ${project.name}:\n`);

  if (environments.length === 0) {
    console.info('  No environments yet. Create one with: mastra env create <project> -n <name>\n');
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
  }
  console.info('');
}

async function createEnvironmentAction(
  projectArg: string,
  options: { name: string; type?: string; json?: boolean },
) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await findProject(token, orgId, projectArg);
  const type = (options.type || 'staging') as 'production' | 'staging' | 'preview';

  const environment = await createEnvironment(token, orgId, project.id, {
    name: options.name,
    type,
  });

  if (options.json) {
    console.log(JSON.stringify({ environment }, null, 2));
    return;
  }

  console.info(`\nCreated environment: ${environment.name}`);
  console.info(`  Slug: ${environment.slug}`);
  console.info(`  ID: ${environment.id}`);
  console.info(`  Type: ${environment.type}\n`);
}

async function deleteEnvironmentAction(projectArg: string, envArg: string, options?: { yes?: boolean }) {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);

  const project = await findProject(token, orgId, projectArg);
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
