import type { ToolCall } from '../../../services/transcript';

export const commandTool: ToolCall = {
  toolCallId: 'command',
  toolName: 'execute_command',
  args: { command: 'pnpm test' },
  argsText: '',
  status: 'running',
  output: 'Live shell output',
  result: 'Partial structured output',
};

export const editTool: ToolCall = {
  toolCallId: 'edit',
  toolName: 'edit_file',
  args: { path: 'file.ts', old_string: 'before', new_string: 'after' },
  argsText: '',
  status: 'done',
  output: '',
  result: 'File updated',
};

export const longResultTool: ToolCall = {
  toolCallId: 'read',
  toolName: 'view',
  argsText: '',
  status: 'done',
  output: '',
  result: 'File contents\n'.repeat(100),
};
