import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';

/**
 * Anchor stub for tests that render components which route through the framework
 * `Link`. Mirrors the real `Link` contract (accepts both `to` and `href`) so
 * assertions can read the resolved `href`.
 */
export const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  function StubLink({ children, to, href, ...props }, ref) {
    return (
      <a ref={ref} href={to ?? href} {...props}>
        {children}
      </a>
    );
  },
);

// Every path resolves to the id-bearing route so tests can assert real hrefs
// where they matter and simply render everywhere else.
const stubLinkPaths: LinkComponentProviderProps['paths'] = {
  agentLink: id => `/agents/${id}`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId, toolId) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId, skillName) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId, threadId) => `/agents/${agentId}/chat/${threadId}`,
  agentNewThreadLink: agentId => `/agents/${agentId}/chat/new`,
  workflowsLink: () => '/workflows',
  workflowLink: id => `/workflows/${id}`,
  schedulesLink: () => '/schedules',
  scheduleLink: id => `/schedules/${id}`,
  networkLink: id => `/networks/${id}`,
  networkNewThreadLink: id => `/networks/${id}/chat/new`,
  networkThreadLink: (networkId, threadId) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: id => `/scorers/${id}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: id => `/cms/scorers/${id}`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: id => `/cms/agents/${id}`,
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
};

/** Wraps children in a `LinkComponentProvider` backed by {@link StubLink}. */
export function TestLinkProvider({ children }: { children: ReactNode }) {
  return (
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={stubLinkPaths}>
      {children}
    </LinkComponentProvider>
  );
}
