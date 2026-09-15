import type { ArrayElementWrapperProps } from '@autoform/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Check, ChevronRight, Trash2 } from 'lucide-react';
import { useContext, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { ArrayAddButtonContext, ArrayItemPathContext, FormReadOnlyContext } from '../field-context';

function itemSummary(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.values(value).find((field): field is string => typeof field === 'string' && field.trim().length > 0);
}

export function ArrayElementWrapper({ children, onRemove, index }: ArrayElementWrapperProps) {
  const path = useContext(ArrayItemPathContext);
  const readOnly = useContext(FormReadOnlyContext);
  const addButtonRef = useContext(ArrayAddButtonContext);
  const { control, getFieldState, formState } = useFormContext();
  const value: unknown = useWatch({ control, name: path });
  const summary = itemSummary(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [disclosure, setDisclosure] = useState({ expanded: !summary, dismissedSubmission: 0 });
  const invalid = getFieldState(path, formState).invalid;
  const hasNewErrors = invalid && formState.submitCount > disclosure.dismissedSubmission;
  const expanded = disclosure.expanded || hasNewErrors;

  function changeExpanded(expanded: boolean) {
    setDisclosure({ expanded, dismissedSubmission: formState.submitCount });
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={changeExpanded}
      className="overflow-hidden rounded-lg border border-border1 bg-surface2 motion-reduce:[&_[data-slot=collapsible-content]]:transition-none motion-reduce:[&_svg]:transition-none"
    >
      <div className="flex min-w-0 items-center gap-1 pr-1">
        <CollapsibleTrigger
          ref={triggerRef}
          aria-label={`Item ${index + 1}${summary ? `: ${summary}` : ''}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-ui-sm focus-visible:ring-inset focus-visible:shadow-none"
        >
          <ChevronRight aria-hidden className="size-3.5 shrink-0 text-neutral3" />
          <span className="shrink-0 text-neutral3">Item {index + 1}</span>
          {summary && (
            <span className="truncate text-neutral5" title={summary}>
              {summary}
            </span>
          )}
          {invalid && <span className="ml-auto shrink-0 text-ui-xs text-accent2">Needs input</span>}
        </CollapsibleTrigger>
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            className="size-11"
            aria-label={`Remove item ${index + 1}`}
            onClick={() => {
              onRemove();
              addButtonRef?.current?.focus();
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <CollapsibleContent keepMounted className="border-t border-border1 px-3 py-3">
        {children}
        {!readOnly && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-label={`Done editing item ${index + 1}`}
              onClick={() => {
                changeExpanded(false);
                triggerRef.current?.focus();
              }}
              icon={<Check />}
            >
              Done
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
