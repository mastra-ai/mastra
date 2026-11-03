import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  ListFilterPlusIcon,
  PlusIcon,
  ListFilterPlus,
  X,
} from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { PickMultiPanel } from './pick-multi-panel';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Button } from '@/ds/components/Button/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { Combobox } from '@/ds/components/Combobox/combobox';
import { Field, FieldError } from '@/ds/components/Field';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';
import { Txt } from '@/ds/components/Txt';
import {
  MENU_SIDE_OFFSET,
  menuEmptyClass,
  menuItemButtonClass,
  menuItemTrailingIconClass,
} from '@/ds/primitives/menu-item';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

const FilterMenuButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
  <button type="button" role="menuitem" data-filter-item="" ref={ref} {...props} />
));
FilterMenuButton.displayName = 'FilterMenuButton';

export type PropertyFilterCreatorProps = {
  fields: PropertyFilterField[];
  tokens: PropertyFilterToken[];
  onTokensChange: (tokens: PropertyFilterToken[]) => void;
  label?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  onStartTextFilter?: (fieldId: string) => void;
  hiddenFieldIds?: readonly string[];
};

export function PropertyFilterCreator({
  fields,
  tokens,
  onTokensChange,
  label = 'Add filter',
  disabled,
  size,
  onStartTextFilter,
  hiddenFieldIds,
}: PropertyFilterCreatorProps) {
  const visibleFields = useMemo(() => {
    if (!hiddenFieldIds || hiddenFieldIds.length === 0) return fields;
    const hidden = new Set(hiddenFieldIds);
    return fields.filter(f => !hidden.has(f.id));
  }, [fields, hiddenFieldIds]);
  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [openPickMultiFieldId, setOpenPickMultiFieldId] = useState<string | undefined>();

  const skipCloseFocusRef = useRef(false);

  const togglePickMulti = useCallback((id: string) => {
    setOpenPickMultiFieldId(current => (current === id ? undefined : id));
  }, []);
  const closePickMulti = useCallback(() => setOpenPickMultiFieldId(undefined), []);

  useEffect(() => {
    if (!open) setOpenPickMultiFieldId(undefined);
  }, [open]);

  const selectedField = useMemo(() => visibleFields.find(f => f.id === fieldId), [visibleFields, fieldId]);
  const singleUseFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const token of tokens) {
      const field = fields.find(f => f.id === token.fieldId);
      if (field && field.kind !== 'pick-multi') ids.add(token.fieldId);
    }
    return ids;
  }, [tokens, fields]);

  const reset = useCallback(() => {
    setFieldId(undefined);
    setMultiValue([]);
    setError(undefined);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const replacePickMultiToken = useCallback(
    (fieldId: string, value: string | string[]) => {
      const existingIndex = tokens.findIndex(t => t.fieldId === fieldId);

      if (Array.isArray(value) && value.length === 0) {
        if (existingIndex === -1) return;
        onTokensChange(tokens.filter((_, i) => i !== existingIndex));
        return;
      }

      if (existingIndex === -1) {
        onTokensChange([...tokens, { fieldId, value }]);
        return;
      }

      const nextTokens = [...tokens];
      nextTokens[existingIndex] = { fieldId, value };
      onTokensChange(nextTokens);
    },
    [onTokensChange, tokens],
  );

  const commit = useCallback(() => {
    if (!selectedField) {
      setError('Choose a property first.');
      return;
    }
    if (singleUseFieldIds.has(selectedField.id)) {
      setError(`Remove the existing ${selectedField.label} filter before adding another.`);
      return;
    }
    if (multiValue.length === 0) {
      setError(`Choose at least one ${selectedField.label.toLowerCase()} value.`);
      return;
    }
    onTokensChange([...tokens, { fieldId: selectedField.id, value: multiValue }]);
    setOpen(false);
  }, [multiValue, onTokensChange, selectedField, singleUseFieldIds, tokens]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} disabled={disabled} icon={<ListFilterPlusIcon />}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        className={cn('w-64', selectedField ? 'p-3' : 'p-1')}
        initialFocus={false}
        finalFocus={() => {
          if (skipCloseFocusRef.current) {
            skipCloseFocusRef.current = false;
            return false;
          }
          return true;
        }}
      >
        <div className={cn('grid', selectedField && 'gap-3')}>
          {selectedField && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Back to properties"
                className={cn(quietTextHover, controlStateColorTransition)}
                onClick={reset}
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <FilterIcon className="size-4 shrink-0 text-muted-foreground" />
              <Txt as="span" variant="caption" tone="muted">{`${selectedField.label} is`}</Txt>
            </div>
          )}

          {!selectedField && (
            <div
              role="menu"
              className="max-h-[80dvh] overflow-auto"
              onKeyDown={e => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
                const buttons = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-filter-item]:not([disabled])'),
                );
                if (buttons.length === 0) return;
                e.preventDefault();
                const active = document.activeElement as HTMLElement | null;
                const current = buttons.findIndex(b => b === active);
                let next: number;
                if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = buttons.length - 1;
                else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % buttons.length;
                else next = current <= 0 ? buttons.length - 1 : current - 1;
                buttons[next]?.focus();
              }}
            >
              <>
                {visibleFields.length > 0 ? (
                  visibleFields.map(f => {
                    const used = singleUseFieldIds.has(f.id);
                    if (f.kind === 'pick-multi') {
                      return (
                        <PickMultiMenuItem
                          key={f.id}
                          field={f}
                          tokens={tokens}
                          onChange={replacePickMultiToken}
                          open={openPickMultiFieldId === f.id}
                          onToggle={togglePickMulti}
                          onClose={closePickMulti}
                        />
                      );
                    }
                    return (
                      <FilterMenuButton
                        key={f.id}
                        className={cn(menuItemButtonClass, 'group')}
                        disabled={used}
                        onClick={() => {
                          setError(undefined);
                          if (f.kind === 'text') {
                            onTokensChange([...tokens, { fieldId: f.id, value: '' }]);
                            onStartTextFilter?.(f.id);
                            skipCloseFocusRef.current = true;
                            setOpen(false);
                            return;
                          }
                          setFieldId(f.id);
                        }}
                      >
                        <span className="truncate">{f.label}</span>
                        {used ? (
                          <span className="ml-auto text-muted-foreground">In use</span>
                        ) : (
                          <span
                            className={cn(
                              menuItemTrailingIconClass,
                              'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus:opacity-100',
                            )}
                          >
                            <PlusIcon />
                          </span>
                        )}
                      </FilterMenuButton>
                    );
                  })
                ) : (
                  <div className={menuEmptyClass}>No matching property.</div>
                )}
              </>
            </div>
          )}

          {selectedField && (
            <Field invalid={Boolean(error)}>
              <Combobox
                multiple
                options={selectedField.options ?? []}
                value={multiValue}
                onValueChange={v => {
                  setMultiValue(v);
                  setError(undefined);
                }}
                placeholder={selectedField.placeholder ?? `Choose ${selectedField.label}`}
                searchPlaceholder={`Search ${selectedField.label.toLowerCase()}`}
                emptyText={selectedField.emptyText ?? 'No option found.'}
                size="md"
                aria-label={selectedField.label}
              />
              <FieldError>{error}</FieldError>
            </Field>
          )}

          {selectedField && (
            <div className="flex items-center justify-end gap-2">
              <Button icon={<X />} variant="ghost" size="md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button icon={<ListFilterPlus />} size="md" onClick={commit}>
                Add filter
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type PickMultiField = Extract<PropertyFilterField, { kind: 'pick-multi' }>;

type PickMultiMenuItemProps = {
  field: PickMultiField;
  tokens: PropertyFilterToken[];
  onChange: (fieldId: string, value: string | string[]) => void;
  open: boolean;
  onToggle: (fieldId: string) => void;
  onClose: () => void;
};

function PickMultiMenuItem({ field, tokens, onChange, open, onToggle, onClose }: PickMultiMenuItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (next) onToggle(field.id);
        else onClose();
      }}
    >
      <PopoverTrigger asChild>
        <FilterMenuButton
          className={menuItemButtonClass}
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            if (!open) onToggle(field.id);
            e.preventDefault();
            requestAnimationFrame(() => {
              const first = contentRef.current?.querySelector<HTMLElement>(
                'input, button, [tabindex]:not([tabindex="-1"])',
              );
              first?.focus();
            });
          }}
        >
          {open && <ChevronRightIcon className="text-muted-foreground" />}
          <span className="truncate">{field.label}</span>
          {!open && (
            <span className={cn(menuItemTrailingIconClass, 'text-muted-foreground')}>
              <ChevronRightIcon />
            </span>
          )}
        </FilterMenuButton>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side="right"
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        className="w-64 p-0"
        initialFocus={false}
        onKeyDown={e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>('[data-pick-multi-item]:not([disabled])'),
          );
          if (items.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          const active = document.activeElement as HTMLElement | null;
          const current = items.findIndex(el => el === active);
          let next: number;
          if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = items.length - 1;
          else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
          else next = current <= 0 ? items.length - 1 : current - 1;
          items[next]?.focus();
        }}
        data-pick-multi-panel
      >
        <PickMultiPanel field={field} tokens={tokens} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
