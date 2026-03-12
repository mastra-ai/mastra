import {
  AnchorHTMLAttributes,
  createContext,
  forwardRef,
  ForwardRefExoticComponent,
  RefAttributes,
  useContext,
} from 'react';

// Define the props type for your Link component
export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement>;

// Define the actual component type with ref attributes
export type LinkComponent = ForwardRefExoticComponent<LinkComponentProps & RefAttributes<HTMLAnchorElement>>;

type LinkComponentPaths = {
  agentLink: (agentId: string) => string;
  agentsLink: () => string;
  agentToolLink: (agentId: string, toolId: string) => string;
  agentSkillLink: (agentId: string, skillName: string, workspaceId?: string) => string;
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) => string;
  agentNewThreadLink: (agentId: string) => string;

  workflowsLink: () => string;
  workflowLink: (workflowId: string) => string;

  networkLink: (networkId: string) => string;
  networkNewThreadLink: (networkId: string) => string;
  networkThreadLink: (networkId: string, threadId: string) => string;

  scorerLink: (scorerId: string) => string;
  cmsScorersCreateLink: () => string;
  cmsScorerEditLink: (scorerId: string) => string;

  cmsAgentCreateLink: () => string;
  cmsAgentEditLink: (agentId: string) => string;

  promptBlockLink: (promptBlockId: string) => string;
  promptBlocksLink: () => string;
  cmsPromptBlockCreateLink: () => string;
  cmsPromptBlockEditLink: (promptBlockId: string) => string;

  toolLink: (toolId: string) => string;
  skillLink: (skillName: string, workspaceId?: string) => string;
  workspacesLink: () => string;
  workspaceLink: (workspaceId?: string) => string;
  workspaceSkillLink: (skillName: string, workspaceId?: string) => string;
  processorsLink: () => string;
  processorLink: (processorId: string) => string;

  mcpServerLink: (serverId: string) => string;
  mcpServerToolLink: (serverId: string, toolId: string) => string;
  workflowRunLink: (workflowId: string, runId: string) => string;

  datasetLink: (datasetId: string) => string;
  datasetItemLink: (datasetId: string, itemId: string) => string;
  datasetExperimentLink: (datasetId: string, experimentId: string) => string;
};

const LinkComponentContext = createContext<{
  Link: LinkComponent;
  navigate: (path: string) => void;
  paths: LinkComponentPaths;
}>({
  Link: forwardRef<HTMLAnchorElement, LinkComponentProps>(() => null),
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
    networkLink: () => '',
    networkNewThreadLink: () => '',
    networkThreadLink: () => '',
    scorerLink: () => '',
    cmsScorersCreateLink: () => '',
    cmsScorerEditLink: () => '',
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
    datasetExperimentLink: () => '',
  },
});

export interface LinkComponentProviderProps {
  children: React.ReactNode;
  Link: LinkComponent;
  navigate: (path: string) => void;
  paths: LinkComponentPaths;
}

export const LinkComponentProvider = ({ children, Link, navigate, paths }: LinkComponentProviderProps) => {
  return <LinkComponentContext.Provider value={{ Link, navigate, paths }}>{children}</LinkComponentContext.Provider>;
};

export const useLinkComponent = () => {
  const ctx = useContext(LinkComponentContext);

  if (!ctx) {
    throw new Error('useLinkComponent must be used within a LinkComponentProvider');
  }

  return ctx;
};
