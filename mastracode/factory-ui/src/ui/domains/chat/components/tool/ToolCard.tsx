import { Activity, ActivityContent, ActivityHeadline } from '@mastra/playground-ui/components/ai/activity';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { ActivityTimedTrigger } from '@mastra/playground-ui/domains/chat/activity';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { ToolBody, toolHasBody, toolKnowledgeCard } from './ToolBody';

export function ToolCard({
  tool,
  open,
  onOpenChange,
}: {
  tool: ToolCall;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const presented = presentTool(tool.toolName, tool.args);
  const { icon: ToolIcon, description, command } = presented;
  // A finished Knowledge call says what it did ("Read Refunds", "Pinned Escalation Process") like Studio's card.
  const knowledge = toolKnowledgeCard(tool);
  const label = knowledge?.title ?? presented.label;
  const detail = knowledge ? knowledge.detail : presented.detail;
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
