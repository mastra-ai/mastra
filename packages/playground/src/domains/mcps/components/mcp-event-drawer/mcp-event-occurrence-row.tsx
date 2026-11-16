import type { McpServerEventOccurrence } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Card } from '@mastra/playground-ui/components/Card';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** Prefix the server stamps on occurrences sent with "Send test event". */
export const TEST_EVENT_ID_PREFIX = 'mastra-test-';

/** One occurrence: id, time and a test badge; its data expands below. */
export function McpEventOccurrenceRow({ occurrence }: { occurrence: McpServerEventOccurrence }) {
  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left">
          <DisclosureChevron direction="right" className="size-4 shrink-0" />
          <Txt as="span" variant="caption" font="mono" className="min-w-0 flex-1 truncate">
            {occurrence.eventId}
          </Txt>
          {occurrence.eventId.startsWith(TEST_EVENT_ID_PREFIX) && (
            <Badge size="xs" variant="amber" emphasis="subtle">
              test
            </Badge>
          )}
          <Txt as="span" variant="caption" font="mono" tone="muted" className="shrink-0">
            {occurrence.timestamp}
          </Txt>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CodeEditor
            value={JSON.stringify(occurrence.data, null, 2)}
            language="json"
            editable={false}
            lineNumbers={false}
            showCopyButton={false}
            variant="embedded"
            aria-label={`Event ${occurrence.eventId} data`}
            className="px-3 pb-3"
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
