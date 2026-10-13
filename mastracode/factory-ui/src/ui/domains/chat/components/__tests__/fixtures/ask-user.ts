import type { AgentControllerEvent } from '@mastra/client-js';
import type { AskUserPayload } from '@mastra/playground-ui/components/ai/ask-user';

export const askUserPayload: AskUserPayload = {
  question: 'How should Admin type the new RPC result?',
  options: [{ label: 'Regenerate the client' }, { label: 'Keep the current client' }],
  selectionMode: 'single_select',
};

export const askUserSuspension: Extract<AgentControllerEvent, { type: 'tool_suspended' }> = {
  type: 'tool_suspended',
  toolCallId: 'ask-call-1',
  toolName: 'ask_user',
  args: askUserPayload,
  suspendPayload: askUserPayload,
};
