import { Activity, ActivityContent, ActivityHeadline } from '@mastra/playground-ui/components/ai/activity';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { ActivityTimedTrigger } from '@mastra/playground-ui/domains/chat/activity';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { ToolBody, toolHasBody } from './ToolBody';

export function ToolCard({
  tool,
  open,
  onOpenChange,
}: {
  tool: ToolCall;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { icon: ToolIcon, label, detail, description, command } = presentTool(tool.toolName, tool.args);
  const foldable = toolHasBody(tool, command);

  return (
    <Activity
      appearance="inline"
      foldable={foldable}
      status={toolCallStatus(tool.status)}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
      open={open && foldable}
      onOpenChange={onOpenChange}
    >
      <ActivityTimedTrigger at={tool.createdAt}>
        <ActivityHeadline icon={<ToolIcon aria-hidden />} label={label} detail={detail} description={description} />
      </ActivityTimedTrigger>
      <ActivityContent>
        <ToolBody tool={tool} command={command} />
      </ActivityContent>
    </Activity>
  );
}
