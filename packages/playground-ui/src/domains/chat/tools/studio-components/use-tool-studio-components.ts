import type { GetAgentResponse } from '@mastra/client-js';
import { useAgent } from '@mastra/react/hooks/agents';
import { useContext } from 'react';
import { ToolStudioComponentsContext } from './studio-components-context-value';
import { ChatAgentContext } from '@/domains/chat/context/chat-context';

const selectStudioComponents = (agent: GetAgentResponse | null): Record<string, string> | undefined => {
  const entries = Object.entries(agent?.tools ?? {}).flatMap(([toolName, tool]) => {
    const id = tool.ui?.studioComponent;
    return id ? [[toolName, id] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/** Custom Studio component ids of the chat agent's tools, keyed by the tool name the model calls. */
export function useToolStudioComponents(): Record<string, string> | undefined {
  const studioComponents = useContext(ToolStudioComponentsContext);
  const chatAgent = useContext(ChatAgentContext);
  const agentId = chatAgent?.agentId;
  const { data } = useAgent({
    agentId,
    requestContext: chatAgent?.requestContext,
    queryOptions: { enabled: Boolean(studioComponents && agentId), select: selectStudioComponents },
  });
  return data;
}
