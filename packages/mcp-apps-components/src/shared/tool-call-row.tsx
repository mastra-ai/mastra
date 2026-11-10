import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Txt } from '@mastra/playground-ui/components/Txt';

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
 * Stands in for Studio's chat `MessageRow` in MCP Apps (see `scripts/build-apps.ts`): span details draw each tool
 * call as a chat row, which brings the whole chat (forms, workflow graphs, nested MCP App hosting) into the page.
 * Apps draw the call's input and result as JSON instead.
 */
export function MessageRow({ message }: { message: MastraDBMessage; readOnly?: boolean }) {
  return (
    <>
      {message.content.parts.map((part, index) => {
        if (part.type !== 'tool-invocation') return null;
        const call = part.toolInvocation as ToolInvocation;
        return (
          <details key={index} data-slot="message" className="border-border my-1 rounded-lg border px-3 py-2">
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
    </>
  );
}
