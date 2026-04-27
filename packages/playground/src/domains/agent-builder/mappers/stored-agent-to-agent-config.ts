import type { AgentConfig } from '../components/agent-builder-edit/agent-configure-panel';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

export function storedAgentToAgentConfig(storedAgent: StoredAgent | null | undefined, fallbackId: string): AgentConfig {
  return {
    id: storedAgent?.id ?? fallbackId,
    name: storedAgent?.name ?? '',
    description: storedAgent?.description ?? '',
    systemPrompt: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
  };
}
