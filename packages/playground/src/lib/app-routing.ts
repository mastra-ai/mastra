import { v4 as uuid } from '@lukeed/uuid';
import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import type { LinkComponentProviderProps } from '@/lib/framework';

export const agentThreadsIndexLoader = ({ params }: LoaderFunctionArgs) =>
  redirect(`/agents/${params.agentId}/threads/new`);

export const agentIndexLoader = ({ params }: LoaderFunctionArgs) => redirect(`/agents/${params.agentId}/overview`);

export const legacyAgentChatLoader = ({ params, request }: LoaderFunctionArgs) => {
  const search = new URL(request.url).search;
  return redirect(`/agents/${params.agentId}/threads/${params.threadId ?? 'new'}${search}`);
};

export const legacyAgentSettingsLoader = ({ params, request }: LoaderFunctionArgs) => {
  const search = new URL(request.url).search;
  return redirect(`/agents/${params.agentId}/overview${search}`);
};

export const REVIEW_QUEUE_PATH = '/experiments/review-queue';

/** Deep link into the review queue, optionally preselecting an experiment and featuring one of its results. */
export const experimentReviewQueueLink = (experimentId?: string, resultId?: string) => {
  const search = new URLSearchParams();
  if (experimentId) search.set('experiment', experimentId);
  if (resultId) search.set('review', resultId);
  const query = search.toString();
  return query ? `${REVIEW_QUEUE_PATH}?${query}` : REVIEW_QUEUE_PATH;
};

export const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}/overview`,
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}?agentId=${encodeURIComponent(agentId)}${skillPath ? `&path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  agentsLink: () => `/agents`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/threads/new`,
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) =>
    messageId
      ? `/agents/${agentId}/threads/${threadId}?messageId=${messageId}`
      : `/agents/${agentId}/threads/${threadId}`,
  workflowsLink: () => `/workflows`,
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  schedulesLink: () => `/workflows/schedules`,
  scheduleLink: (scheduleId: string) => `/workflows/schedules/${encodeURIComponent(scheduleId)}`,
  networkLink: (networkId: string) => `/networks/v-next/${networkId}/chat`,
  networkNewThreadLink: (networkId: string) => `/networks/v-next/${networkId}/chat/${uuid()}`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/v-next/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}/edit`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}/edit`,
  promptBlockLink: (promptBlockId: string) => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompts/${promptBlockId}/edit`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}${skillPath ? `?path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  workspaceSkillLink: (skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}${skillPath ? `?path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  workspacesLink: () => `/workspaces`,
  processorsLink: () => `/processors`,
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcps/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/graph/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  datasetItemCompareLink: (datasetId: string, itemId: string, secondItemId: string) =>
    `/datasets/${datasetId}/items/${itemId}/compare/${secondItemId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
};
