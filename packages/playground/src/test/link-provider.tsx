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
//
// Typed via assertion (not annotation) on purpose: CI's Changed Test Gate
// typechecks this file against the base branch, whose `LinkComponentPaths`
// may not match the head branch's exactly. The assertion tolerates extra
// keys so the stub can carry entries for both versions.
const paths: Record<string, (...args: string[]) => string> = {
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
  datasetItemCompareLink: (datasetId, itemId, secondItemId) =>
    `/datasets/${datasetId}/items/${itemId}/compare/${secondItemId}`,
  // Only used by the base branch's `LinkComponentPaths` (see comment above).
  datasetExperimentLink: (datasetId, experimentId) => `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: id => `/experiments/${id}`,
};

// eslint-disable-next-line react-refresh/only-export-components -- test helper co-located with the provider.
export const stubLinkPaths = paths as LinkComponentProviderProps['paths'];

/** Wraps children in a `LinkComponentProvider` backed by {@link StubLink}. */
export function TestLinkProvider({ children }: { children: ReactNode }) {
  return (
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={stubLinkPaths}>
      {children}
    </LinkComponentProvider>
  );
}
