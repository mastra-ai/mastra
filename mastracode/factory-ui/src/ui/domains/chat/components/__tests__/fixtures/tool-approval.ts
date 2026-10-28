import type { ApprovalPrompt } from '../../../services/transcript';

export const toolApproval: ApprovalPrompt = {
  kind: 'approval',
  id: 'approval-1',
  toolCallId: 'call-1',
  toolName: 'write_file',
  args: { path: 'src/agent.ts' },
};
