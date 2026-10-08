import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import type { ReactNode } from 'react';

/** Use the available content width, including after the sidebar has been resized. */
export function ToolPlaygroundLayout({
  variant,
  request,
  response,
}: {
  variant: 'inline' | 'workspace';
  request: ReactNode;
  response: ReactNode;
}) {
  if (variant === 'workspace') {
    return (
      <ScrollArea className="@container/tool-playground min-h-0 min-w-0" mask={false}>
        <div className="grid min-w-0 gap-6 p-4 @[48rem]/tool-playground:grid-cols-2">
          <div className="min-w-0">{request}</div>
          <section aria-label="Tool result" className="min-w-0">
            {response}
          </section>
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-6">
      {request}
      {response}
    </div>
  );
}
