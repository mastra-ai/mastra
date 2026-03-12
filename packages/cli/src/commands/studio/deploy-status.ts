import { MASTRA_CLOUD_API_URL, authHeaders } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';

interface DeployInfo {
  id: string;
  projectId: string;
  organizationId: string;
  projectName: string;
  status: string;
  instanceUrl: string | null;
  error: string | null;
  createdAt: string | null;
}

async function fetchStatus(deployId: string, token: string, orgId: string): Promise<DeployInfo> {
  const resp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deployId}`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch status: ${resp.status} — ${text}`);
  }

  const data = (await resp.json()) as { deploy: DeployInfo };
  return data.deploy;
}

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
  console.info(`   Project:  ${deploy.projectName} (${deploy.projectId})`);
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

  if (opts.watch) {
    let lastStatus = '';
    console.info(`Watching deploy ${deployId}...\n`);

    while (true) {
      const deploy = await fetchStatus(deployId, token, orgId);

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
    const deploy = await fetchStatus(deployId, token, orgId);
    printDeploy(deploy);
  }
}
