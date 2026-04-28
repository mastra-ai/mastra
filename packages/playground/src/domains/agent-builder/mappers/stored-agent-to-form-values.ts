import type { AgentBuilderEditFormValues } from '../schemas';
import { extractWorkspaceId } from './extract-workspace-id';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

export function storedAgentToFormValues(storedAgent: StoredAgent | null | undefined): AgentBuilderEditFormValues {
  const avatarUrl =
    storedAgent?.metadata && typeof storedAgent.metadata === 'object' && 'avatarUrl' in storedAgent.metadata
      ? (storedAgent.metadata.avatarUrl as string | undefined)
      : undefined;

  return {
    name: storedAgent?.name ?? '',
    description: storedAgent?.description ?? '',
    instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
    tools: Object.fromEntries(Object.keys(storedAgent?.tools ?? {}).map(k => [k, true])),
    agents: Object.fromEntries(Object.keys(storedAgent?.agents ?? {}).map(k => [k, true])),
    workflows: Object.fromEntries(Object.keys(storedAgent?.workflows ?? {}).map(k => [k, true])),
    workspaceId: extractWorkspaceId(storedAgent?.workspace),
    visibility: storedAgent?.visibility ?? 'private',
    avatarUrl,
  };
}
