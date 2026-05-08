import * as p from '@clack/prompts';

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
    const finalStatus = await pollServerDeploy(deployId, token, orgId);

    if (finalStatus.status === 'running') {
      p.outro(finalStatus.instanceUrl ? `Restart complete! ${finalStatus.instanceUrl}` : 'Restart complete!');
    } else if (finalStatus.status === 'failed') {
      p.log.error(`Restart failed: ${finalStatus.error ?? 'unknown error'}`);
      process.exit(1);
    } else {
      p.log.warning(`Restart ended with status: ${finalStatus.status}`);
      process.exit(1);
    }
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
