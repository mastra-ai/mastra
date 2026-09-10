import * as p from '@clack/prompts';

import { deployDashboardUrl, printDeployFailure } from '../../utils/deploy-failure-output.js';
import { resolveAuth, resolveProjectId } from './env.js';
import { pauseServerProject, pollServerDeploy, restartServerProject } from './platform-api.js';

export async function serverPauseAction(opts: { config?: string; project?: string; org?: string }) {
  p.intro('mastra server pause');
  try {
    const { token, orgId } = await resolveAuth(opts.org);
    const projectId = await resolveProjectId(opts, { token, orgId });
    await pauseServerProject(token, orgId, projectId);
    p.outro('Server paused.');
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function serverRestartAction(opts: { config?: string; project?: string; org?: string }) {
  p.intro('mastra server restart');
  try {
    const { token, orgId } = await resolveAuth(opts.org);
    const projectId = await resolveProjectId(opts, { token, orgId });

    const s = p.spinner();
    s.start('Requesting restart...');
    const deployId = await restartServerProject(token, orgId, projectId);
    s.stop(`Restart queued: ${deployId}`);

    p.log.step('Streaming deploy logs...');
    const collectedLogs: string[] = [];
    const finalStatus = await pollServerDeploy(deployId, token, orgId, undefined, { collectLogs: collectedLogs });

    if (finalStatus.status === 'running') {
      p.outro(finalStatus.instanceUrl ? `Restart complete! ${finalStatus.instanceUrl}` : 'Restart complete!');
    } else {
      printDeployFailure({
        message:
          finalStatus.status === 'failed'
            ? `Restart failed: ${finalStatus.error ?? 'unknown error'}`
            : `Restart ended with status: ${finalStatus.status}`,
        collectedLogs,
        dashboardUrl: deployDashboardUrl('server', { orgId, projectId, deployId }),
      });
      process.exit(1);
    }
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
