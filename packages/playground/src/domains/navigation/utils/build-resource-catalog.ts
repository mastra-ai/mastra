import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { PromptIcon } from '@mastra/playground-ui/icons/PromptIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import type { BuildResourceKind } from './build-resource-history';
import type { NavIcon } from '@/lib/nav/nav-items';

export const buildResourceCatalog: Record<
  BuildResourceKind,
  { path: string; label: string; queryKey: string; Icon: NavIcon }
> = {
  agent: { path: '/agents', label: 'Agent', queryKey: 'agent', Icon: AgentIcon },
  workflow: { path: '/workflows', label: 'Workflow', queryKey: 'workflow', Icon: WorkflowIcon },
  prompt: { path: '/prompts', label: 'Prompt', queryKey: 'stored-prompt-block', Icon: PromptIcon },
  tool: { path: '/tools', label: 'Tool', queryKey: 'tool', Icon: ToolsIcon },
  processor: { path: '/processors', label: 'Processor', queryKey: 'processor', Icon: ProcessorIcon },
};
