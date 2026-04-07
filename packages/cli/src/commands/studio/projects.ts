import * as p from '@clack/prompts';
import { fetchOrgs } from '../auth/api.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { fetchProjects, createProject } from './platform-api.js';

/**
 * Resolve the current org, auto-selecting if only one exists.
 */
async function resolveCurrentOrg(token: string): Promise<{ orgId: string; orgName: string }> {
  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (currentOrgId) {
    const match = orgs.find(o => o.id === currentOrgId);
    if (match) return { orgId: match.id, orgName: match.name };
  }

  if (orgs.length === 1) {
    return { orgId: orgs[0]!.id, orgName: orgs[0]!.name };
  }

  if (orgs.length === 0) {
    throw new Error('No organizations found.');
  }

  const selected = await p.select({
    message: 'Select an organization',
    options: orgs.map(o => ({ value: o.id, label: `${o.name} (${o.id})` })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const org = orgs.find(o => o.id === selected)!;
  return { orgId: org.id, orgName: org.name };
}

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
