import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';

import { spanSubject } from '../../lib/humanize-span-name';
import { ToolCallShell } from './tool-call-shell';
import type { EntryRendererProps } from './types';

/**
 * Shared by tool_call, client_tool_call, provider_tool_call and mcp_tool_call (decision 2).
 *
 * A tool call reads the same here as it does in chat, so it is drawn with the same component:
 * `presentTool` gives the row a readable label and the salient argument. Its icon is dropped —
 * the timeline rail already marks the row's kind, and a second icon on the same line repeats it.
 */
export function ToolCallEntry({ span, adornment }: EntryRendererProps) {
  const { label, detail } = presentTool(span.entityId ?? span.name ?? '', span.input);

  return (
    <ToolCallShell
      adornment={adornment}
      testId="tool-call-entry"
      failed={Boolean(span.error)}
      error={span.error}
      label={label || spanSubject(span)}
      detail={detail}
      sections={[
        { label: 'Arguments', value: span.input },
        { label: 'Result', value: span.output },
      ]}
    />
  );
}
