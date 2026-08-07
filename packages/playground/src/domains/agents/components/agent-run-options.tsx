import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { AgentRequestContextRunOptionsBody } from './request-context-run-options';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

interface AgentRunOptionsContentProps {
  requestContextSchema?: string;
}

// Shared between both editor columns so they stay the same height.
const RUN_OPTIONS_EDITOR_HEIGHT = 'h-[260px] md:h-[360px]';

export function AgentRunOptionsContent({ requestContextSchema }: AgentRunOptionsContentProps) {
  return (
    <ScrollArea className="w-full" maxHeight="min(600px, calc(100dvh - 8rem))">
      <div className="space-y-4 p-4">
        <Txt as="h3" variant="ui-md" className="text-neutral3">
          Run options
        </Txt>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <AgentRequestContextRunOptionsBody
              requestContextSchema={requestContextSchema}
              requestContextTooltip="Request context values are passed into experiments and test chats."
              freeformEditorClassName={RUN_OPTIONS_EDITOR_HEIGHT}
            />
          </section>

          <section className="min-w-0">
            <TracingRunOptions
              className="px-0 py-0"
              editorClassName={RUN_OPTIONS_EDITOR_HEIGHT}
              hideTitle
              showEditorHeader
            />
          </section>
        </div>
      </div>
    </ScrollArea>
  );
}
