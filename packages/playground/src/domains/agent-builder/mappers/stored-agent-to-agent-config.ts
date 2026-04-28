import type { AgentConfig } from '../components/agent-builder-edit/agent-configure-panel';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

export function storedAgentToAgentConfig(storedAgent: StoredAgent | null | undefined, fallbackId: string): AgentConfig {
  const avatarUrl =
    storedAgent?.metadata && typeof storedAgent.metadata === 'object' && 'avatarUrl' in storedAgent.metadata
      ? (storedAgent.metadata.avatarUrl as string | undefined)
      : undefined;

  return {
    id: storedAgent?.id ?? fallbackId,
    name: storedAgent?.name ?? '',
    description: storedAgent?.description ?? '',
    avatarUrl,
    systemPrompt: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
    visibility: storedAgent?.visibility ?? 'private',
    authorId: storedAgent?.authorId,
  };
}
