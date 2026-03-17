import { getToken, getCurrentOrgId, validateOrgAccess } from '../auth/credentials.js';
import { fetchProjects } from './platform-api.js';

const statusIcon: Record<string, string> = {
  starting: '🚀',
  running: '✅',
  stopped: '⏹️',
  failed: '❌',
  unknown: '❓',
};

export async function deploysAction() {
  const token = await getToken();
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('No organization selected. Run: mastra auth login');
    process.exit(1);
  }

  await validateOrgAccess(token, orgId);

  const projects = await fetchProjects(token, orgId);

  if (projects.length === 0) {
    console.info('No deploys found.');
    return;
  }

  for (const project of projects) {
    const status = project.latestDeployStatus ?? 'none';
    const icon = statusIcon[status] ?? '❓';
    const url = project.instanceUrl ?? '';

    console.info(`${icon} ${project.name} (${project.id})`);
    console.info(`   Latest:   ${project.latestDeployId ?? 'none'} — ${status}`);
    if (url) {
      console.info(`   URL:      ${url}`);
    }
    console.info('');
  }
}
