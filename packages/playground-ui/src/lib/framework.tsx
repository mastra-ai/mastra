import type { AnchorHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from 'react';
import { createContext, forwardRef, useContext } from 'react';

export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export type LinkComponent = ForwardRefExoticComponent<LinkComponentProps & RefAttributes<HTMLAnchorElement>>;

export type LinkComponentPaths = {
  agentLink: (agentId: string) => string;
  agentsLink: () => string;
  agentToolLink: (agentId: string, toolId: string) => string;
  agentSkillLink: (agentId: string, skillName: string, skillPath?: string, workspaceId?: string) => string;
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) => string;
  agentNewThreadLink: (agentId: string) => string;

  workflowsLink: () => string;
  workflowLink: (workflowId: string) => string;
  schedulesLink: () => string;
  scheduleLink: (scheduleId: string) => string;

  networkLink: (networkId: string) => string;
  networkNewThreadLink: (networkId: string) => string;
  networkThreadLink: (networkId: string, threadId: string) => string;

  scorerLink: (scorerId: string, params?: { scoreId?: string; entity?: string }) => string;
  cmsScorersCreateLink: () => string;
  cmsScorerEditLink: (scorerId: string) => string;

  agentCreateLink?: () => string;
  agentEditLink?: (agentId: string) => string;
  /** @deprecated Use agentCreateLink. */
  cmsAgentCreateLink: () => string;
  /** @deprecated Use agentEditLink. */
  cmsAgentEditLink: (agentId: string) => string;

  promptBlockLink: (promptBlockId: string) => string;
  promptBlocksLink: () => string;
  cmsPromptBlockCreateLink: () => string;
  cmsPromptBlockEditLink: (promptBlockId: string) => string;

  toolLink: (toolId: string) => string;
  skillLink: (skillName: string, skillPath?: string, workspaceId?: string) => string;
  workspacesLink: () => string;
  workspaceLink: (workspaceId?: string) => string;
  workspaceSkillLink: (skillName: string, skillPath?: string, workspaceId?: string) => string;
  processorsLink: () => string;
  processorLink: (processorId: string) => string;

  mcpServerLink: (serverId: string) => string;
  mcpServerToolLink: (serverId: string, toolId: string) => string;
  workflowRunLink: (workflowId: string, runId: string) => string;

  datasetLink: (datasetId: string) => string;
  datasetItemLink: (datasetId: string, itemId: string) => string;
  experimentLink: (experimentId: string) => string;
  experimentItemLink: (experimentId: string, itemId: string) => string;

  traceLink: (traceId: string, spanId?: string) => string;
};

type ResolvedLinkComponentPaths = LinkComponentPaths &
  Required<Pick<LinkComponentPaths, 'agentCreateLink' | 'agentEditLink'>>;

const LinkComponentContext = createContext<{
  Link: LinkComponent;
  navigate: (path: string) => void;
  paths: ResolvedLinkComponentPaths;
}>({
  Link: forwardRef<HTMLAnchorElement, LinkComponentProps>(function DefaultLink(_props, _ref) {
    return null;
  }),
  navigate: () => {},
  paths: {
    agentLink: () => '',
    agentsLink: () => '',
    agentToolLink: () => '',
    agentSkillLink: () => '',
    agentThreadLink: () => '',
    agentNewThreadLink: () => '',
    workflowsLink: () => '',
    workflowLink: () => '',
    schedulesLink: () => '',
    scheduleLink: () => '',
    networkLink: () => '',
    networkNewThreadLink: () => '',
    networkThreadLink: () => '',
    scorerLink: () => '',
    cmsScorersCreateLink: () => '',
    cmsScorerEditLink: () => '',
    agentCreateLink: () => '',
    agentEditLink: () => '',
    cmsAgentCreateLink: () => '',
    cmsAgentEditLink: () => '',
    promptBlockLink: () => '',
    promptBlocksLink: () => '',
    cmsPromptBlockCreateLink: () => '',
    cmsPromptBlockEditLink: () => '',
    toolLink: () => '',
    skillLink: () => '',
    workspacesLink: () => '',
    workspaceLink: () => '',
    workspaceSkillLink: () => '',
    processorsLink: () => '',
    processorLink: () => '',
    mcpServerLink: () => '',
    mcpServerToolLink: () => '',
    workflowRunLink: () => '',
    datasetLink: () => '',
    datasetItemLink: () => '',
    experimentLink: () => '',
    experimentItemLink: () => '',
    traceLink: () => '',
  },
});

export interface LinkComponentProviderProps {
  children: React.ReactNode;
  Link: LinkComponent;
  navigate: (path: string) => void;
  paths: LinkComponentPaths;
}

export const LinkComponentProvider = ({ children, Link, navigate, paths }: LinkComponentProviderProps) => {
  const resolvedPaths: ResolvedLinkComponentPaths = {
    ...paths,
    agentCreateLink: paths.agentCreateLink ?? paths.cmsAgentCreateLink,
    agentEditLink: paths.agentEditLink ?? paths.cmsAgentEditLink,
  };
  return (
    <LinkComponentContext.Provider value={{ Link, navigate, paths: resolvedPaths }}>
      {children}
    </LinkComponentContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLinkComponent = () => {
  const ctx = useContext(LinkComponentContext);

  if (!ctx) {
    throw new Error('useLinkComponent must be used within a LinkComponentProvider');
  }

  return ctx;
};
