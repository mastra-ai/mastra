import { getCurrentOrgId, getToken, validateOrgAccess } from '../auth/credentials.js';
import { pollForDiagnosis, printDeploySuggestions } from '../deploy-suggestions.js';
import { fetchDeployDiagnosis, fetchProjects, startDeployDiagnosis } from './platform-api.js';
import type { Project } from './platform-api.js';
import { loadProjectConfig } from './project-config.js';

function getLatestProjectDeploy(projects: Project[], linkedProjectId?: string) {
  const linkedProject = linkedProjectId ? projects.find(project => project.id === linkedProjectId) : null;
  if (linkedProject) {
    if (linkedProject.latestDeployId) {
      return { deployId: linkedProject.latestDeployId, projectName: linkedProject.name };
    }

    throw new Error(
      `No deploys found for linked Studio project ${linkedProject.name}. Run a failed deployment first with \`mastra studio deploy\`. The suggestions command helps debug failed deployments, and you can run it afterward with \`mastra studio deploy suggestions <deploy-id>\` or \`mastra studio deploy suggestions\`.`,
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

  return { deployId: latestProject.latestDeployId, projectName: latestProject.name };
}

async function resolveDeployId(token: string, orgId: string, deployId?: string) {
  if (deployId) {
    return deployId;
  }

  const projectConfig = await loadProjectConfig(process.cwd());
  const latestDeploy = getLatestProjectDeploy(
    (await fetchProjects(token, orgId)).filter(project => project.organizationId === orgId),
    projectConfig?.organizationId === orgId ? projectConfig.projectId : undefined,
  );

  if (!latestDeploy) {
    throw new Error('No previous studio deploy found. Pass a deploy ID or deploy first.');
  }

  console.info(
    `Using latest deploy: ${latestDeploy.deployId}${latestDeploy.projectName ? ` (${latestDeploy.projectName})` : ''}`,
  );
  return latestDeploy.deployId;
}

export async function suggestionsAction(deployId?: string) {
  const token = await getToken();
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('No organization selected. Run: mastra auth login');
    process.exit(1);
  }

  await validateOrgAccess(token, orgId);

  const targetDeployId = await resolveDeployId(token, orgId, deployId);
  const initialDiagnosis = await fetchDeployDiagnosis(targetDeployId, token, orgId);

  if (initialDiagnosis.state === 'healthy') {
    console.info('Deploy is running successfully. No suggestions required.');
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
    console.info('Deploy is running successfully. No suggestions required.');
    return;
  }

  if (diagnosisResult.diagnosis.status === 'FAILED') {
    console.info(`Diagnosis failed: ${diagnosisResult.diagnosis.error ?? 'unknown error'}`);
    process.exit(1);
  }

  printDeploySuggestions(targetDeployId, diagnosisResult.diagnosis);
}
