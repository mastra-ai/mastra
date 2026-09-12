import type { ReactNode } from 'react';
import {
  ToolCall,
  ToolCallContent,
  ToolCallEdit,
  ToolCallMono,
  ToolCallPresentedHeader,
  ToolCallTrigger,
  presentTool,
  stringifyToolValue,
  toolEdit,
} from '@/ds/components/ai/tool-call';
import type { ToolCallStatus } from '@/ds/components/ai/tool-call';

interface ReviewToolProps {
  toolName: string;
  args: unknown;
  status?: ToolCallStatus;
  output?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

export function ReviewTool({ toolName, args, status = 'idle', output, children, defaultOpen }: ReviewToolProps) {
  const presentation = presentTool(toolName, args);
  const edit = toolEdit(toolName, args);
  const input = stringifyToolValue(args);
  return (
    <ToolCall status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader {...presentation} />
      </ToolCallTrigger>
      <ToolCallContent>
        {edit ? <ToolCallEdit edit={edit} /> : <ToolCallMono copyText={input}>{input}</ToolCallMono>}
        {output && <ToolCallMono copyText={output}>{output}</ToolCallMono>}
        {children}
      </ToolCallContent>
    </ToolCall>
  );
}
