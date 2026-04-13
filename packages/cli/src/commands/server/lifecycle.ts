import { resolveAuth, resolveProjectId } from './env.js';
import { pauseServerProject, restartServerProject } from './platform-api.js';

export async function serverPauseAction(opts: { config?: string; project?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts, { token, orgId });
  await pauseServerProject(token, orgId, projectId);
  console.info('\n  Server paused.\n');
}

export async function serverRestartAction(opts: { config?: string; project?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts, { token, orgId });
  await restartServerProject(token, orgId, projectId);
  console.info('\n  Server restart requested.\n');
}
