import { Icon, ScrollArea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Txt } from '@mastra/playground-ui';
import { Info } from 'lucide-react';

import { AgentRequestContextRunOptionsBody } from './request-context-run-options';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

interface AgentRunOptionsContentProps {
  requestContextSchema?: string;
}

const RUN_OPTIONS_MAX_HEIGHT = 'min(600px, calc(100dvh - 8rem))';
const RUN_OPTIONS_EDITOR_HEIGHT = 'h-[260px] md:h-[360px]';
const REQUEST_CONTEXT_TOOLTIP = 'Request context values are passed into experiments and test chats.';

function RunOptionsSectionHeader({ title, tooltip }: { title: string; tooltip?: string }) {
  return (
    <div className="flex h-7 items-center gap-1.5">
      <Txt as="h4" variant="ui-sm" className="text-neutral4">
        {title}
      </Txt>

      {tooltip && (
        <TooltipProvider delay={10}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${title} details`}
                className="text-neutral3 transition-colors hover:text-neutral6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border2 rounded-sm"
              >
                <Icon size="sm">
                  <Info />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export function AgentRunOptionsContent({ requestContextSchema }: AgentRunOptionsContentProps) {
  return (
    <ScrollArea className="w-full" maxHeight={RUN_OPTIONS_MAX_HEIGHT}>
      <div className="p-4 space-y-4">
        <Txt as="h3" variant="ui-md" className="text-neutral3">
          Run options
        </Txt>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-3">
            <RunOptionsSectionHeader title="Context" tooltip={REQUEST_CONTEXT_TOOLTIP} />
            <AgentRequestContextRunOptionsBody
              requestContextSchema={requestContextSchema}
              freeformEditorClassName={RUN_OPTIONS_EDITOR_HEIGHT}
            />
          </section>

          <section className="min-w-0 space-y-3">
            <RunOptionsSectionHeader title="Tracing" />
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
