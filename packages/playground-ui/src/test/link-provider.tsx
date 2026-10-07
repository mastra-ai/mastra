import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';

export const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  function StubLink({ children, to, href, ...props }, ref) {
    return (
      <a ref={ref} href={to ?? href} {...props}>
        {children}
      </a>
    );
  },
);

// Changed Test Gate also checks these paths against the base branch.
const paths: Record<string, (...args: any[]) => string> = {
  agentLink: id => `/agents/${id}`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId, toolId) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId, skillName) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId, threadId) => `/agents/${agentId}/threads/${threadId}`,
  agentNewThreadLink: agentId => `/agents/${agentId}/threads/new`,
  workflowsLink: () => '/workflows',
  workflowLink: id => `/workflows/${id}`,
  schedulesLink: () => '/schedules',
  scheduleLink: id => `/schedules/${id}`,
  networkLink: id => `/networks/${id}`,
  networkNewThreadLink: id => `/networks/${id}/chat/new`,
  networkThreadLink: (networkId, threadId) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: (id: string, params?: { scoreId?: string; entity?: string }) => {
    const query = new URLSearchParams(
      Object.entries(params ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `/scorers/${id}?${query}` : `/scorers/${id}`;
  },
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: id => `/cms/scorers/${id}`,
  cmsAgentCreateLink: () => '/agent-builder/agents/create',
  cmsAgentEditLink: id => `/agent-builder/agents/${id}/edit`,
  promptBlockLink: id => `/prompt-blocks/${id}`,
  promptBlocksLink: () => '/prompt-blocks',
  cmsPromptBlockCreateLink: () => '/cms/prompt-blocks/create',
  cmsPromptBlockEditLink: id => `/cms/prompt-blocks/${id}`,
  toolLink: id => `/tools/${id}`,
  skillLink: skillName => `/skills/${skillName}`,
  workspacesLink: () => '/workspaces',
  workspaceLink: id => `/workspaces/${id ?? ''}`,
  workspaceSkillLink: skillName => `/workspaces/skills/${skillName}`,
  processorsLink: () => '/processors',
  processorLink: id => `/processors/${id}`,
  mcpServerLink: id => `/mcps/${id}`,
  mcpServerToolLink: (serverId, toolId) => `/mcps/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId, runId) => `/workflows/${workflowId}/runs/${runId}`,
  datasetLink: id => `/datasets/${id}`,
  datasetItemLink: (datasetId, itemId) => `/datasets/${datasetId}/items/${itemId}`,
  datasetExperimentLink: (datasetId, experimentId) => `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: id => `/experiments/${id}`,
  experimentItemLink: (id, itemId) => `/experiments/${id}/items/${itemId}`,
  traceLink: (traceId, spanId) => `/traces?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`,
};

// eslint-disable-next-line react-refresh/only-export-components -- test helper co-located with the provider.
export const stubLinkPaths = paths as LinkComponentProviderProps['paths'];

export function TestLinkProvider({
  children,
  paths: overrides,
}: {
  children: ReactNode;
  paths?: Partial<LinkComponentProviderProps['paths']>;
}) {
  return (
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={{ ...stubLinkPaths, ...overrides }}>
      {children}
    </LinkComponentProvider>
  );
}
