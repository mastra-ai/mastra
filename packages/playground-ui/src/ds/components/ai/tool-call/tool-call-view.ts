import { stripAnsi, stripSerializedAnsi } from './ansi';
import { hasToolArguments, stringifyToolValue } from './tool-presentation';
import type { ActivityStatus } from '@/ds/components/ai/activity';

export interface ToolCallView {
  toolName: string;
  args?: unknown;
  argsText?: string;
  hideArguments?: boolean;
  status: ActivityStatus;
  command?: string;
  /** What the call printed while it ran, such as a command's stdout and stderr. */
  output?: string;
  result?: unknown;
}

export function toolCallResultText({ status, result }: ToolCallView): string | undefined {
  if (status === 'running' || result === undefined || result === null) return undefined;
  const text = typeof result === 'string' ? stripAnsi(result) : stripSerializedAnsi(stringifyToolValue(result));
  return text || undefined;
}

export function toolCallHasBody(view: ToolCallView): boolean {
  if (view.command || view.output) return true;
  return hasToolArguments(view) || toolCallResultText(view) !== undefined;
}
