import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';

export interface ComparisonItemPayloadProps {
  label: string;
  value: unknown;
}

/**
 * Collapsed-by-default view of an item payload (input or ground truth) so the
 * comparison table can show it in place instead of sending the user back to the
 * dataset item page.
 */
export function ComparisonItemPayload({ label, value }: ComparisonItemPayloadProps) {
  if (value == null) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="text-ui-xs text-neutral3 hover:text-neutral6 group flex items-center gap-1">
        <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent role="region" aria-label={label}>
        <pre className="text-ui-xs text-neutral4 bg-surface3 mt-1 max-h-40 overflow-auto rounded-md p-2 whitespace-pre-wrap">
          {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
