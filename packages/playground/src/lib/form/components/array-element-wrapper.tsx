import type { ArrayElementWrapperProps } from '@autoform/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Check, ChevronRight, Trash2 } from 'lucide-react';
import { useContext, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { ArrayAddButtonContext, FieldPathContext, FormReadOnlyContext } from '../field-context';
import { useSectionDisclosure } from '../use-section-disclosure';
import { isPlainObject } from '../utils';

const HUMAN_SUMMARY_KEYS = ['title', 'name', 'label'];

function firstFilledText(values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function itemSummary(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!isPlainObject(value)) return undefined;
  return firstFilledText(HUMAN_SUMMARY_KEYS.map(key => value[key])) ?? firstFilledText(Object.values(value));
}

export function ArrayElementWrapper({ children, onRemove, index }: ArrayElementWrapperProps) {
  const path = useContext(FieldPathContext);
  const readOnly = useContext(FormReadOnlyContext);
  const addButtonRef = useContext(ArrayAddButtonContext);
  const { control } = useFormContext();
  const value: unknown = useWatch({ control, name: path });
  const summary = itemSummary(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { expanded, invalid, setExpanded } = useSectionDisclosure(path, !summary);
  const itemLabel = `Item ${index + 1}${summary ? `: ${summary}` : ''}`;

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="border-border bg-background overflow-hidden rounded-lg border motion-reduce:[&_[data-slot=collapsible-content]]:transition-none motion-reduce:[&_svg]:transition-none"
    >
      <div className="flex min-w-0 items-center gap-1 pr-1">
        <CollapsibleTrigger
          ref={triggerRef}
          aria-label={invalid ? `${itemLabel}, Needs input` : itemLabel}
          className="text-caption flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left focus-visible:shadow-none focus-visible:ring-inset"
        >
          <ChevronRight aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground shrink-0">Item {index + 1}</span>
          {summary && (
            <span className="text-foreground truncate" title={summary}>
              {summary}
            </span>
          )}
          {invalid && <span className="text-meta text-accent2 ml-auto shrink-0">Needs input</span>}
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
      <CollapsibleContent keepMounted className="border-border border-t px-3 py-3">
        {children}
        {!readOnly && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-label={`Done editing item ${index + 1}`}
              onClick={() => {
                setExpanded(false);
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
