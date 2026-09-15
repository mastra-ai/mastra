import type { ArrayWrapperProps } from '@autoform/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Brackets, Plus } from 'lucide-react';
import { Children, useContext, useRef } from 'react';
import { ArrayAddButtonContext, FormReadOnlyContext } from '../field-context';

export function ArrayWrapper({ label, children, onAddItem }: ArrayWrapperProps) {
  const readOnly = useContext(FormReadOnlyContext);
  const count = Children.count(children);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Txt as="h3" variant="ui-sm" className="flex items-center gap-1.5 text-neutral3">
          <Brackets aria-hidden className="size-3.5" />
          {label} <span className="tabular-nums">{count}</span>
        </Txt>
        {!readOnly && (
          <Button
            ref={addButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Add ${label} item`}
            onClick={onAddItem}
          >
            <Plus />
            Add item
          </Button>
        )}
      </div>
      {count === 0 ? (
        <Txt as="p" variant="ui-sm" className="py-2 text-neutral3">
          No items added
        </Txt>
      ) : (
        <ArrayAddButtonContext value={addButtonRef}>
          <div className="flex flex-col gap-2">{children}</div>
        </ArrayAddButtonContext>
      )}
    </div>
  );
}
