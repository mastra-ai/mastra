import * as p from '@clack/prompts';

import { pollForDiagnosis, printDeploySuggestions } from '../deploy-suggestions.js';
import { resolveAuth, resolveProjectId } from './env.js';
import { fetchServerDeployDiagnosis, fetchServerProjectDetail, startServerDeployDiagnosis } from './platform-api.js';

async function resolveDeployId(token: string, orgId: string, deployId?: string) {
  if (deployId) {
    return deployId;
  }

  const projectId = await resolveProjectId({}, { token, orgId });
  const { project } = await fetchServerProjectDetail(token, orgId, projectId);
  if (!project.latestDeployId) {
    throw new Error(
      `No deploys found for linked Server project ${project.name}. Run a failed deployment first with \`mastra server deploy\`. The suggestions command helps debug failed deployments, and you can run it afterward with \`mastra server deploy suggestions <deploy-id>\` or \`mastra server deploy suggestions\`.`,
    );
  }

  p.log.info(`Using latest deploy: ${project.latestDeployId}${project.name ? ` (${project.name})` : ''}`);
  return project.latestDeployId;
}

export async function serverSuggestionsAction(deployId: string | undefined, opts: { org?: string }) {
  p.intro('mastra server deploy suggestions');
  try {
    const { token, orgId } = await resolveAuth(opts.org);
    const targetDeployId = await resolveDeployId(token, orgId, deployId);

    const initialDiagnosis = await fetchServerDeployDiagnosis(targetDeployId, token, orgId);
    if (initialDiagnosis.state === 'healthy') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    if (initialDiagnosis.state === 'missing') {
      await startServerDeployDiagnosis(targetDeployId, token, orgId);
    }

    let isFirstPoll = initialDiagnosis.state === 'ready';
    const diagnosisResult = await pollForDiagnosis(async () => {
      if (isFirstPoll) {
        isFirstPoll = false;
        return initialDiagnosis;
      }

      return fetchServerDeployDiagnosis(targetDeployId, token, orgId);
    });

    if (diagnosisResult.state !== 'ready') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    if (diagnosisResult.diagnosis.status === 'FAILED') {
      p.log.error(`Diagnosis failed: ${diagnosisResult.diagnosis.error ?? 'unknown error'}`);
      process.exit(1);
    }

    printDeploySuggestions(targetDeployId, diagnosisResult.diagnosis);
    p.outro('Suggestions ready.');
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
