import * as p from '@clack/prompts';

import { withPollingRetries } from '../../utils/polling.js';
import { getCurrentOrgId, getToken, validateOrgAccess } from '../auth/credentials.js';
import { pollForDiagnosis, printDeploySuggestions } from '../deploy-suggestions.js';
import { fetchDeployDiagnosis, fetchProjects, startDeployDiagnosis } from './platform-api.js';
import type { Project } from './platform-api.js';
import { loadProjectConfig } from './project-config.js';

function getLatestProjectDeploy(projects: Project[], linkedProjectId?: string) {
  const linkedProject = linkedProjectId ? projects.find(project => project.id === linkedProjectId) : null;
  if (linkedProject) {
    if (linkedProject.latestDeployId) {
      return { deployId: linkedProject.latestDeployId, projectId: linkedProject.id, projectName: linkedProject.name };
    }

    throw new Error(
      `No deploys found for linked Studio project ${linkedProject.name}. The suggestions command helps debug failed deployments, and you can run it after a deployment fails with \`mastra studio deploy suggestions <deploy-id>\` or \`mastra studio deploy suggestions\`.`,
    );
  }

  if (linkedProjectId) {
    throw new Error(
      `Linked Studio project ${linkedProjectId} was not found in this organization. Re-link your project or pass a deploy ID explicitly.`,
    );
  }

  const latestProject = projects
    .filter(project => project.latestDeployId)
    .sort((left, right) => {
      const leftTime = left.latestDeployCreatedAt ? Date.parse(left.latestDeployCreatedAt) : 0;
      const rightTime = right.latestDeployCreatedAt ? Date.parse(right.latestDeployCreatedAt) : 0;
      return rightTime - leftTime;
    })[0];

  if (!latestProject?.latestDeployId) {
    return null;
  }

  return { deployId: latestProject.latestDeployId, projectId: latestProject.id, projectName: latestProject.name };
}

async function resolveDeployId(
  token: string,
  orgId: string,
  deployId?: string,
): Promise<{ deployId: string; projectId?: string }> {
  if (deployId) {
    return { deployId };
  }

  const projectConfig = await loadProjectConfig(process.cwd());
  const latestDeploy = getLatestProjectDeploy(
    (await fetchProjects(token, orgId)).filter(project => project.organizationId === orgId),
    projectConfig?.organizationId === orgId ? projectConfig.projectId : undefined,
  );

  if (!latestDeploy) {
    throw new Error('No previous studio deploy found. Pass a deploy ID or deploy first.');
  }

  p.log.info(
    `Using latest deploy: ${latestDeploy.deployId}${latestDeploy.projectName ? ` (${latestDeploy.projectName})` : ''}`,
  );
  return { deployId: latestDeploy.deployId, projectId: latestDeploy.projectId };
}

export async function suggestionsAction(deployId?: string) {
  p.intro('mastra studio deploy suggestions');

  try {
    const token = await getToken();
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      p.log.error('No organization selected. Run: mastra auth login');
      process.exit(1);
    }

    await validateOrgAccess(token, orgId);

    const resolved = await resolveDeployId(token, orgId, deployId);
    const targetDeployId = resolved.deployId;
    const initialDiagnosis = await withPollingRetries(() => fetchDeployDiagnosis(targetDeployId, token, orgId));

    if (initialDiagnosis.state === 'healthy') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    if (initialDiagnosis.state === 'missing') {
      await startDeployDiagnosis(targetDeployId, token, orgId);
    }

    let isFirstPoll = initialDiagnosis.state === 'ready';
    const diagnosisResult = await pollForDiagnosis(async () => {
      if (isFirstPoll) {
        isFirstPoll = false;
        return initialDiagnosis;
      }

      return fetchDeployDiagnosis(targetDeployId, token, orgId);
    });

    if (diagnosisResult.state !== 'ready') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    const logsUrl = resolved.projectId
      ? `https://projects.mastra.ai/orgs/${orgId}/studio/projects/${resolved.projectId}/deploys/${targetDeployId}`
      : undefined;

    if (diagnosisResult.diagnosis.status === 'FAILED') {
      p.log.error(`Diagnosis failed: ${diagnosisResult.diagnosis.error ?? 'unknown error'}`);
      p.log.step(`Deploy logs: ${logsUrl ?? 'https://projects.mastra.ai'}`);
      process.exit(1);
    }

    printDeploySuggestions(targetDeployId, diagnosisResult.diagnosis, { logsUrl });
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
