import type { ReactNode } from 'react';
import { Activity, ActivityContent, ActivityHeadline, ActivityTrigger } from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { ToolCallArguments, ToolCallOutput, presentTool } from '@/ds/components/ai/tool-call';

interface ReviewToolProps {
  toolName: string;
  args: unknown;
  status?: ActivityStatus;
  output?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

export function ReviewTool({ toolName, args, status = 'idle', output, children, defaultOpen }: ReviewToolProps) {
  const { icon: ToolIcon, label, detail } = presentTool(toolName, args);
  return (
    <Activity status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ActivityTrigger>
        <ActivityHeadline icon={<ToolIcon aria-hidden />} label={label} detail={detail} />
      </ActivityTrigger>
      <ActivityContent>
        <ToolCallArguments toolName={toolName} args={args} />
        {output && <ToolCallOutput text={output} />}
        {children}
      </ActivityContent>
    </Activity>
  );
}
