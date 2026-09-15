import { ToolCallGroup } from '@mastra/playground-ui/components/ai/tool-call';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { ToolTime } from '../ToolTime';
import { ToolCard } from './ToolCard';

export function ToolGroup({ tools }: { tools: ToolCall[] }) {
  return (
    <ToolCallGroup
      steps={tools.map(tool => ({ toolName: tool.toolName, args: tool.args, status: toolCallStatus(tool.status) }))}
      leading={<ToolTime at={tools[0].createdAt} />}
    >
      {tools.map(tool => (
        <ToolCard key={tool.toolCallId} tool={tool} />
      ))}
    </ToolCallGroup>
  );
}
