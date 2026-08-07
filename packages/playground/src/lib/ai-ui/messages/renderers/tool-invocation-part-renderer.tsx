import type { ToolInvocationPart } from '@mastra/react';

import type { DataMessagePart } from '../../tools/tool-card';
import { ToolCard } from '../../tools/tool-card';
import type { MessageMetadata } from '../message-metadata';

export interface ToolInvocationPartRendererProps {
  part: ToolInvocationPart;
  metadata?: MessageMetadata;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

/**
 * Renders a `MessageFactory` `ToolInvocation` slot by adapting the v4-style
 * `toolInvocation` payload (`args`/`result`) into `ToolCard`'s plain
 * `input`/`output` contract.
 */
export const ToolInvocationPartRenderer = ({ part, metadata, dataParts }: ToolInvocationPartRendererProps) => {
  const inv = part.toolInvocation;
  const input = 'args' in inv ? inv.args : undefined;
  const output = 'result' in inv ? inv.result : undefined;

  return (
    <ToolCard
      toolName={inv.toolName}
      input={input}
      output={output}
      toolCallId={inv.toolCallId}
      state={inv.state}
      metadata={metadata}
      dataParts={dataParts}
    />
  );
};
