import * as p from '@clack/prompts';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { fetchProjects, createProject } from './platform-api.js';

export async function listProjectsAction() {
  const token = await getToken();
  const { orgId, orgName } = await resolveCurrentOrg(token);
  const projects = await fetchProjects(token, orgId);

  console.info(`\nProjects in ${orgName}:\n`);

  if (projects.length === 0) {
    console.info('  No projects yet. Run: mastra studio projects create\n');
    return;
  }

  for (const proj of projects) {
    const status = proj.latestDeployStatus ? ` [${proj.latestDeployStatus}]` : '';
    console.info(`  ${proj.name}${status}`);
    console.info(`    ID: ${proj.id}`);
    if (proj.instanceUrl) {
      console.info(`    URL: ${proj.instanceUrl}`);
    }
  }
  console.info('');
}

export async function createProjectAction() {
  const token = await getToken();
  const { orgId, orgName } = await resolveCurrentOrg(token);

  const name = await p.text({
    message: `Project name (in ${orgName})`,
    placeholder: 'my-mastra-app',
    validate: v => (!v || v.trim().length === 0 ? 'Name is required' : undefined),
  });

  if (p.isCancel(name)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const project = await createProject(token, orgId, name as string);
  console.info(`\nCreated project: ${project.name} (${project.id})\n`);
}
