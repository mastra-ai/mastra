import { getToken, getCurrentOrgId, validateOrgAccess } from '../auth/credentials.js';
import type { DeployInfo } from './platform-api.js';
import { fetchDeployStatus } from './platform-api.js';

function printDeploy(deploy: DeployInfo) {
  const statusIcon: Record<string, string> = {
    starting: '🚀',
    running: '✅',
    stopped: '⏹️',
    failed: '❌',
    unknown: '❓',
  };
  const icon = statusIcon[deploy.status] ?? '❓';

  console.info(`${icon} Deploy ${deploy.id}`);
  console.info(`   Status:   ${deploy.status}`);
  if (deploy.projectName) {
    console.info(`   Project:  ${deploy.projectName}`);
  }
  if (deploy.instanceUrl) {
    console.info(`   URL:      ${deploy.instanceUrl}`);
  }
  if (deploy.error) {
    console.info(`   Error:    ${deploy.error}`);
  }
  if (deploy.createdAt) {
    console.info(`   Created:  ${deploy.createdAt}`);
  }
}

export async function statusAction(deployId: string, opts: { watch?: boolean }) {
  const token = await getToken();
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('No organization selected. Run: mastra auth login');
    process.exit(1);
  }

  await validateOrgAccess(token, orgId);

  if (opts.watch) {
    let lastStatus = '';
    console.info(`Watching deploy ${deployId}...\n`);

    while (true) {
      const deploy = await fetchDeployStatus(deployId, token, orgId);

      if (deploy.status !== lastStatus) {
        printDeploy(deploy);
        console.info('');
        lastStatus = deploy.status;
      }

      if (deploy.status === 'running' || deploy.status === 'failed' || deploy.status === 'stopped') {
        break;
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    const deploy = await fetchDeployStatus(deployId, token, orgId);
    printDeploy(deploy);
  }
}
