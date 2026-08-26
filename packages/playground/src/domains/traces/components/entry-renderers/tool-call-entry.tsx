import { spanSubject } from '../../lib/humanize-span-name';
import { summarize } from './summarize';
import type { EntryRendererProps } from './types';

/** Shared by tool_call, client_tool_call, provider_tool_call and mcp_tool_call (decision 2). */
export function ToolCallEntry({ span }: EntryRendererProps) {
  const args = summarize(span.input);

  return (
    <p className="text-neutral6 text-ui-sm">
      {spanSubject(span)}
      {args ? <span className="text-neutral3"> with {args}</span> : null}
    </p>
  );
}
