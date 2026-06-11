import type { DynamicToolPart } from '@mastra/react';

import type { DataMessagePart } from '../../tools/tool-card';
import { ToolCard } from '../../tools/tool-card';
import type { MessageMetadata } from '../message-metadata';

export interface DynamicToolPartRendererProps {
  part: DynamicToolPart;
  metadata?: MessageMetadata;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

/**
 * Renders a `MessageFactory` `DynamicTool` slot (runtime-only `dynamic-tool` /
 * `tool-${string}` parts). Derives the display tool name from `toolName`,
 * falling back to the `tool-` prefixed part type.
 */
export const DynamicToolPartRenderer = ({ part, metadata, dataParts }: DynamicToolPartRendererProps) => {
  const toolName = part.toolName ?? part.type.replace(/^tool-/, '');

  return (
    <ToolCard
      toolName={toolName}
      input={part.input}
      output={part.output}
      toolCallId={part.toolCallId ?? ''}
      state={part.state}
      metadata={metadata}
      dataParts={dataParts}
    />
  );
};
