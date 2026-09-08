import * as p from '@clack/prompts';

import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { pollForDiagnosis, printDeploySuggestions } from '../deploy-suggestions.js';
import type { Environment, EnvironmentDeploy } from './platform-api.js';
import {
  fetchEnvironmentDeployDiagnosis,
  fetchEnvironmentDeploys,
  fetchEnvironments,
  startEnvironmentDeployDiagnosis,
} from './platform-api.js';
import { resolveProject } from './resolve-project.js';

interface SuggestionsOptions {
  project?: string;
  environment?: string;
}

interface ResolvedTarget {
  projectId: string;
  projectName: string;
  envId: string;
  envSlug: string;
  deployId: string;
}

function findEnvironment(environments: Environment[], envArg: string): Environment | undefined {
  return environments.find((e) => e.id === envArg || e.name === envArg || e.slug === envArg);
}

function pickLatestDeployForEnv(deploys: EnvironmentDeploy[], envId: string): EnvironmentDeploy | undefined {
  const forEnv = deploys.filter((d) => d.environmentId === envId);
  const sorted = [...forEnv].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return sorted[0];
}

async function resolveTarget(
  token: string,
  orgId: string,
  options: SuggestionsOptions,
  deployId?: string,
): Promise<ResolvedTarget> {
  const project = await resolveProject(token, orgId, options.project);

  // When a deploy id is supplied, we still need its environment for the URL.
  // Fetch all deploys once and look it up.
  if (deployId) {
    const deploys = await fetchEnvironmentDeploys(token, orgId, project.id);
    const deploy = deploys.find((d) => d.id === deployId);
    if (!deploy) {
      throw new Error(`Deploy not found in project ${project.name}: ${deployId}`);
    }
    return {
      projectId: project.id,
      projectName: project.name,
      envId: deploy.environmentId,
      envSlug: deploy.environmentSlug,
      deployId,
    };
  }

  // No deploy id: resolve environment (flag or lone environment on project),
  // then pick its latest deploy.
  const environments = await fetchEnvironments(token, orgId, project.id);
  if (environments.length === 0) {
    throw new Error(
      `No environments found for project ${project.name}. Deploy first with \`mastra deploy\`, then rerun \`mastra env suggestions\`.`,
    );
  }

  let environment: Environment | undefined;
  if (options.environment) {
    environment = findEnvironment(environments, options.environment);
    if (!environment) {
      throw new Error(`Environment not found: ${options.environment}`);
    }
  } else if (environments.length === 1) {
    environment = environments[0]!;
  } else {
    const slugs = environments.map((e) => e.slug).join(', ');
    throw new Error(
      `Project ${project.name} has multiple environments (${slugs}). Pass --environment <name|slug|id> or a deploy id.`,
    );
  }

  const deploys = await fetchEnvironmentDeploys(token, orgId, project.id);
  const latest = pickLatestDeployForEnv(deploys, environment.id);
  if (!latest) {
    throw new Error(
      `No deploys found for environment ${environment.slug} in project ${project.name}. The suggestions command helps debug failed deployments; run it after a deployment fails with \`mastra env suggestions <deploy-id>\` or \`mastra env suggestions --environment ${environment.slug}\`.`,
    );
  }

  p.log.info(`Using latest deploy for ${environment.slug}: ${latest.id}`);

  return {
    projectId: project.id,
    projectName: project.name,
    envId: environment.id,
    envSlug: environment.slug,
    deployId: latest.id,
  };
}

function buildLogsUrl(orgId: string, projectId: string, envId: string, deployId: string): string {
  return `https://projects.mastra.ai/orgs/${orgId}/projects/${projectId}/environments/${envId}/deploys/${deployId}`;
}

export async function envSuggestionsAction(deployId: string | undefined, opts: SuggestionsOptions = {}) {
  p.intro('mastra env suggestions');
  try {
    const token = await getToken();
    const { orgId } = await resolveCurrentOrg(token);

    const target = await resolveTarget(token, orgId, opts, deployId);

    const initial = await fetchEnvironmentDeployDiagnosis(token, orgId, target.projectId, target.envId, target.deployId);
    if (initial.state === 'healthy') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    if (initial.state === 'missing') {
      // No diagnosis row yet — kick one off. The API is idempotent; when the
      // platform's own failure hook has already inserted a PENDING row this
      // is a no-op.
      await startEnvironmentDeployDiagnosis(token, orgId, target.projectId, target.envId, target.deployId);
      p.log.info('Diagnosis in progress...');
    } else if (initial.diagnosis.status === 'PENDING') {
      p.log.info('Diagnosis in progress...');
    }

    let firstPoll = initial.state === 'ready';
    const result = await pollForDiagnosis(async () => {
      if (firstPoll) {
        firstPoll = false;
        return initial;
      }
      return fetchEnvironmentDeployDiagnosis(token, orgId, target.projectId, target.envId, target.deployId);
    });

    if (result.state !== 'ready') {
      p.outro('Deploy is running successfully. No suggestions required.');
      return;
    }

    const logsUrl = buildLogsUrl(orgId, target.projectId, target.envId, target.deployId);

    if (result.diagnosis.status === 'FAILED') {
      p.log.error(`Diagnosis failed: ${result.diagnosis.error ?? 'unknown error'}`);
      p.log.step(`Deploy logs: ${logsUrl}`);
      process.exit(1);
    }

    printDeploySuggestions(target.deployId, result.diagnosis, { logsUrl });
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
