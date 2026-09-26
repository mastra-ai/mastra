import type { ArrayWrapperProps } from '@autoform/react';
import { Brackets, Plus } from 'lucide-react';
import { Children, useContext, useRef } from 'react';
import { ArrayAddButtonContext, FormReadOnlyContext } from '../field-context';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

export function ArrayWrapper({ label, children, onAddItem }: ArrayWrapperProps) {
  const readOnly = useContext(FormReadOnlyContext);
  const count = Children.count(children);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Txt as="h3" variant="caption" tone="muted" className="flex items-center gap-1.5">
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
        <Txt as="p" variant="caption" tone="muted" className="py-2">
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
