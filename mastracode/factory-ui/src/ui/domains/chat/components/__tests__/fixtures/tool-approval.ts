import type { ApprovalPrompt } from '@mastra/playground-ui/domains/factory/session/thread/chat/services/transcript';

export const toolApproval: ApprovalPrompt = {
  kind: 'approval',
  id: 'approval-1',
  toolCallId: 'call-1',
  toolName: 'write_file',
  args: { path: 'src/agent.ts' },
};
