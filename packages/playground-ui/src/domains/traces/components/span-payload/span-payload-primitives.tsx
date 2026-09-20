import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SpanPayloadTool } from './span-payload-tool';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

/** Small-caps label above a field of a rich payload. */
export function SpanPayloadLabel({ children }: { children: ReactNode }) {
  return <div className="text-ui-xs text-neutral2 tracking-widest uppercase">{children}</div>;
}

export function SpanPayloadField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="span-payload-field" className="flex flex-col gap-1.5">
      <SpanPayloadLabel>{label}</SpanPayloadLabel>
      {children}
    </div>
  );
}

export function SpanPayloadMarkdown({ children }: { children: string }) {
  return (
    <div data-slot="span-payload-markdown" className="text-ui-md text-neutral5">
      <MarkdownRenderer>{children}</MarkdownRenderer>
    </div>
  );
}

/** A collapsed block for secondary data (reasoning, steps, warnings…). */
export function SpanPayloadCollapsible({
  label,
  children,
  defaultOpen = false,
}: {
  label: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="text-ui-xs text-neutral2 flex items-center gap-1 tracking-widest uppercase [&>svg]:size-3">
        <ChevronRightIcon />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** Tool calls as core records them: `{ toolName, args | input }` when they have that shape, JSON otherwise. */
export function SpanPayloadToolCalls({ toolCalls }: { toolCalls: unknown[] }) {
  return (
    <ul data-slot="span-payload-tool-calls" className="flex flex-col gap-2">
      {toolCalls.map((call, index) => (
        <li key={index}>
          <SpanPayloadTool value={call} showLabel={false} />
        </li>
      ))}
    </ul>
  );
}
