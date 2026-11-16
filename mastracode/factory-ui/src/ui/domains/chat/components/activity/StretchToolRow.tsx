import { useActivityRow } from '@mastra/playground-ui/domains/chat/activity';

import type { ToolCall } from '../../services/transcript';
import { ToolCard } from '../tool/ToolCard';

/** A call listed in an open stretch, open as the reader left it. */
export function StretchToolRow({ tool }: { tool: ToolCall }) {
  const { open, onOpenChange } = useActivityRow(tool.toolCallId);
  return <ToolCard tool={tool} open={open} onOpenChange={onOpenChange} />;
}
