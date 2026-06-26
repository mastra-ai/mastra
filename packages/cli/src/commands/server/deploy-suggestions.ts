import * as p from '@clack/prompts';

import { withPollingRetries } from '../../utils/polling.js';
import { pollForDiagnosis, printDeploySuggestions } from '../deploy-suggestions.js';
import { resolveAuth, resolveProjectId } from './env.js';
import { fetchServerDeployDiagnosis, fetchServerProjectDetail, startServerDeployDiagnosis } from './platform-api.js';

async function resolveDeployId(
  token: string,
  orgId: string,
  deployId?: string,
): Promise<{ deployId: string; projectId?: string }> {
  if (deployId) {
    return { deployId };
  }

  const projectId = await resolveProjectId({}, { token, orgId });
  const { project } = await fetchServerProjectDetail(token, orgId, projectId);
  if (!project.latestDeployId) {
    throw new Error(
      `No deploys found for linked Server project ${project.name}. The suggestions command helps debug failed deployments, and you can run it after a deployment fails with \`mastra server deploy suggestions <deploy-id>\` or \`mastra server deploy suggestions\`.`,
    );
  }

  p.log.info(`Using latest deploy: ${project.latestDeployId}${project.name ? ` (${project.name})` : ''}`);
  return { deployId: project.latestDeployId, projectId };
}

function buildLogsUrl(orgId: string, projectId: string | undefined, deployId: string): string | undefined {
  if (!projectId) return undefined;
  return `https://projects.mastra.ai/orgs/${orgId}/server/projects/${projectId}/deploys/${deployId}`;
}

export async function serverSuggestionsAction(deployId: string | undefined, opts: { org?: string }) {
  p.intro('mastra server deploy suggestions');
  try {
    const { token, orgId } = await resolveAuth(opts.org);
    const resolved = await resolveDeployId(token, orgId, deployId);
    const targetDeployId = resolved.deployId;

    const initialDiagnosis = await withPollingRetries(() => fetchServerDeployDiagnosis(targetDeployId, token, orgId));
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

    const logsUrl = buildLogsUrl(orgId, resolved.projectId, targetDeployId);

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
