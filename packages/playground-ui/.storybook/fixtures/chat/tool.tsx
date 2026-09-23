import type { ReactNode } from 'react';
import {
  ToolCall,
  ToolCallContent,
  ToolCallArguments,
  ToolCallOutput,
  ToolCallPresentedHeader,
  ToolCallTrigger,
  presentTool,
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
  return (
    <ToolCall status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader {...presentation} />
      </ToolCallTrigger>
      <ToolCallContent>
        <ToolCallArguments toolName={toolName} args={args} />
        {output && <ToolCallOutput text={output} />}
        {children}
      </ToolCallContent>
    </ToolCall>
  );
}
