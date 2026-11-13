import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

type ToolInvocation = { toolName: string; args?: unknown; result?: unknown; state?: string };

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null;
  return (
    <div className="flex flex-col gap-1">
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <pre className="bg-muted text-caption text-muted-foreground max-h-64 overflow-auto rounded-md p-2 break-all whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Stands in for Studio's chat `MessageRow` in MCP Apps (see `scripts/build-apps.ts`): the real row brings the whole
 * chat (forms, workflow graphs, nested MCP App hosting) into the page. Apps draw text as plain text, user turns as a
 * bubble, and each tool call's input and result as JSON.
 */
export function MessageRow({
  message,
  className,
  footer,
}: {
  message: MastraDBMessage;
  readOnly?: boolean;
  className?: string;
  footer?: ReactNode;
}) {
  const user = message.role === 'user';
  return (
    <div data-slot="message" className={cn('my-2 flex flex-col gap-1', user && 'items-end', className)}>
      {message.content.parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <Txt
              key={index}
              as="p"
              variant="body"
              className={cn('break-words whitespace-pre-wrap', user && 'bg-muted max-w-[80%] rounded-lg px-3 py-2')}
            >
              {part.text}
            </Txt>
          );
        }
        if (part.type !== 'tool-invocation') return null;
        const call = part.toolInvocation as ToolInvocation;
        return (
          <details key={index} className="border-border w-full rounded-lg border px-3 py-2">
            <summary className="cursor-pointer">
              <Txt as="span" variant="label" className="font-mono">
                {call.toolName}
              </Txt>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Json label="Input" value={call.args} />
              <Json label="Result" value={call.result} />
            </div>
          </details>
        );
      })}
      {footer}
    </div>
  );
}
