import type { ReactNode } from 'react';
import {
  ToolCall,
  ToolCallContent,
  ToolCallCommand,
  ToolCallTime,
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
  const toolPresentation = presentTool(toolName, args);
  return (
    <ToolCall status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader
          {...toolPresentation}
          leading={<ToolCallTime at={Date.parse('2026-09-17T12:24:00Z')} />}
        />
      </ToolCallTrigger>
      <ToolCallContent>
        {toolPresentation.command ? (
          <ToolCallCommand command={toolPresentation.command} />
        ) : (
          <ToolCallArguments toolName={toolName} args={args} />
        )}
        {output && <ToolCallOutput text={output} error={status === 'error'} />}
        {children}
      </ToolCallContent>
    </ToolCall>
  );
}
