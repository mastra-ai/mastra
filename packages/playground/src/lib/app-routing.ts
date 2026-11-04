import { v4 as uuid } from '@lukeed/uuid';
import type { LinkComponentProviderProps } from '@mastra/playground-ui/lib/framework';
import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export const agentThreadsIndexLoader = ({ params }: LoaderFunctionArgs) =>
  redirect(`/agents/${params.agentId}/threads/new`);

export const agentIndexLoader = ({ params }: LoaderFunctionArgs) => redirect(`/agents/${params.agentId}/threads/new`);

export const legacyAgentChatLoader = ({ params, request }: LoaderFunctionArgs) => {
  const search = new URL(request.url).search;
  return redirect(`/agents/${params.agentId}/threads/${params.threadId ?? 'new'}${search}`);
};

const toolSearch = (toolId: string) => `?${new URLSearchParams({ tool: toolId }).toString()}`;

export const legacyAgentSettingsLoader = ({ params, request }: LoaderFunctionArgs) => {
  const search = new URL(request.url).search;
  return redirect(`/agents/${params.agentId}/threads/new${search}`);
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

/** Traces page with a trace open on one of its scores. */
export const traceScoreLink = (traceId: string, scoreId: string) =>
  `/traces?traceId=${encodeURIComponent(traceId)}&scoreId=${encodeURIComponent(scoreId)}`;

/** Skills are browsed as files: open the skill's SKILL.md in the workspace view. */
export function workspaceSkillFileLink(workspaceId?: string, skillPath?: string | null): string {
  if (!workspaceId) return '/workspaces';
  const base = `/workspaces/${encodeURIComponent(workspaceId)}`;
  if (!skillPath) return base;
  const file = `${skillPath.replace(/\/+$/, '')}/SKILL.md`;
  return `${base}?${new URLSearchParams({ file })}`;
}

export const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}/threads/new`,
  agentToolLink: (agentId: string, toolId: string, threadId?: string) =>
    `/agents/${agentId}/threads/${threadId ?? 'new'}${toolSearch(toolId)}`,
  agentSkillLink: (_agentId: string, _skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceSkillFileLink(workspaceId, skillPath),
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
  scorerLink: (scorerId: string, params?: { scoreId?: string; entity?: string }) => {
    const search = new URLSearchParams();
    if (params?.entity) search.set('entity', params.entity);
    if (params?.scoreId) search.set('scoreId', params.scoreId);
    const query = search.toString();
    return query ? `/scorers/${scorerId}?${query}` : `/scorers/${scorerId}`;
  },
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}/edit`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}/edit`,
  promptBlockLink: (promptBlockId: string) => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompts/${promptBlockId}/edit`,
  toolLink: (toolId: string) => `/tools${toolSearch(toolId)}`,
  skillLink: (_skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceSkillFileLink(workspaceId, skillPath),
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  workspaceSkillLink: (_skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceSkillFileLink(workspaceId, skillPath),
  workspacesLink: () => `/workspaces`,
  processorsLink: () => `/processors`,
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcps/${serverId}${toolSearch(toolId)}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/graph/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
  experimentItemLink: (experimentId: string, itemId: string) =>
    `/experiments/${experimentId}/items/${encodeURIComponent(itemId)}`,
  traceLink: (traceId: string, spanId?: string) =>
    `/traces?traceId=${encodeURIComponent(traceId)}${spanId ? `&spanId=${encodeURIComponent(spanId)}` : ''}`,
};
