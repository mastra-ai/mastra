import type { AgentMessage } from './agent-message';
import type { ToolCardProps } from './tool-card';

export function resolveAgentMessages(output: ToolCardProps['output'], fetched: AgentMessage[] = []): AgentMessage[] {
  if (output?.childMessages?.length) return output.childMessages;
  if (output?.subAgentToolResults?.length) {
    return [
      ...output.subAgentToolResults.map(
        (child: { toolName: string; toolCallId: string; args: unknown; result: unknown }) => ({
          type: 'tool' as const,
          toolName: child.toolName,
          toolCallId: child.toolCallId,
          args: child.args,
          toolOutput: child.result,
        }),
      ),
      ...(output.text ? [{ type: 'text' as const, content: output.text }] : []),
    ];
  }
  if (output?.text) return [{ type: 'text', content: output.text }];
  return fetched;
}
