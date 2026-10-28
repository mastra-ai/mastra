import { Activity, ActivityContent, ActivityHeadline } from '@mastra/playground-ui/components/ai/activity';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { TimedTrigger } from '../activity/TimedTrigger';
import { ToolBody, toolHasBody } from './ToolBody';

export function ToolCard({
  tool,
  defaultOpen,
  onOpenChange,
}: {
  tool: ToolCall;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { icon: ToolIcon, label, detail, description, command } = presentTool(tool.toolName, tool.args);

  return (
    <Activity
      appearance="inline"
      foldable={toolHasBody(tool, command)}
      status={toolCallStatus(tool.status)}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <TimedTrigger at={tool.createdAt}>
        <ActivityHeadline icon={<ToolIcon aria-hidden />} label={label} detail={detail} description={description} />
      </TimedTrigger>
      <ActivityContent>
        <ToolBody tool={tool} command={command} />
      </ActivityContent>
    </Activity>
  );
}
