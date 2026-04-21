import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  ListFilterPlusIcon,
  PlusIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PickMultiPanel } from './pick-multi-panel';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Button } from '@/ds/components/Button/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { MultiCombobox } from '@/ds/components/Combobox/multi-combobox';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';
import { cn } from '@/lib/utils';

export type PropertyFilterCreatorProps = {
  fields: PropertyFilterField[];
  tokens: PropertyFilterToken[];
  onTokensChange: (tokens: PropertyFilterToken[]) => void;
  label?: string;
  disabled?: boolean;
  /** Size passed through to the trigger Button. Defaults to 'md'. */
  size?: ButtonProps['size'];
  /**
   * Called when the user picks a text (id-style) field. Consumers are expected
   * to render a pending applied-filter pill with an active input so the user
   * can type the value inline instead of in this popover.
   */
  onStartTextFilter?: (fieldId: string) => void;
};

/**
 * Minimal Linear-style filter creator: a `+ Filter` button whose popover walks
 * the user through property → value → commit. For id-style text fields, the
 * picker closes immediately and the applied-filter pill owns the input. For
 * `pick-multi` fields (e.g. Root Entity Name) hovering the item opens a
 * separate side popover with checkboxes — each check adds its own applied
 * filter and the main popover stays open so users can pick many.
 */
export function PropertyFilterCreator({
  fields,
  tokens,
  onTokensChange,
  label = 'Add Filter',
  disabled,
  size,
  onStartTextFilter,
}: PropertyFilterCreatorProps) {
  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [textValue, setTextValue] = useState('');
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  // Single source of truth for which pick-multi side panel is open. Opens only
  // via explicit click/keyboard press on the menu item — no hover/focus
  // auto-open (was too flicker-prone).
  const [openPickMultiFieldId, setOpenPickMultiFieldId] = useState<string | undefined>();

  const textInputRef = useRef<HTMLInputElement>(null);
  // When the user picks a text field we close this popover and hand off focus
  // to the newly-created pill's input — prevent Radix from returning focus to
  // the trigger button in that case.
  const skipCloseFocusRef = useRef(false);

  const togglePickMulti = useCallback((id: string) => {
    setOpenPickMultiFieldId(current => (current === id ? undefined : id));
  }, []);
  const closePickMulti = useCallback(() => setOpenPickMultiFieldId(undefined), []);

  useEffect(() => {
    if (!open) setOpenPickMultiFieldId(undefined);
  }, [open]);

  const selectedField = useMemo(() => fields.find(f => f.id === fieldId), [fields, fieldId]);
  // Only single-use kinds (text, multi-select) count as "used". `pick-multi`
  // allows multiple tokens with the same fieldId.
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
    setTextValue('');
    setMultiValue([]);
    setError(undefined);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    if (selectedField?.kind === 'text') textInputRef.current?.focus();
  }, [open, selectedField]);

  /**
   * Replace whatever token exists for `fieldId` with the given value. Used by
   * both single-select (radio) and multi-select (checkbox) pick-multi panels.
   * Pass `undefined` or `[]` to remove the token entirely.
   */
  const replacePickMultiToken = useCallback(
    (fieldId: string, value: string | string[] | undefined) => {
      const existingIndex = tokens.findIndex(t => t.fieldId === fieldId);
      const shouldRemove = value === undefined || (Array.isArray(value) && value.length === 0);

      if (shouldRemove) {
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
    if (selectedField.kind === 'text' && !textValue.trim()) {
      setError(`Enter a value for ${selectedField.label}.`);
      return;
    }
    if (selectedField.kind === 'multi-select' && multiValue.length === 0) {
      setError(`Choose at least one ${selectedField.label.toLowerCase()} value.`);
      return;
    }
    const token: PropertyFilterToken =
      selectedField.kind === 'multi-select'
        ? { fieldId: selectedField.id, value: multiValue }
        : { fieldId: selectedField.id, value: (textValue as string).trim() };
    onTokensChange([...tokens, token]);
    setOpen(false);
  }, [multiValue, onTokensChange, selectedField, singleUseFieldIds, textValue, tokens]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled}>
          <ListFilterPlusIcon />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="p-3 w-64"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => {
          if (skipCloseFocusRef.current) {
            skipCloseFocusRef.current = false;
            e.preventDefault();
          }
        }}
      >
        <div className="grid gap-3">
          {selectedField && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Back to properties"
                className="text-neutral3 hover:text-neutral6 transition-colors"
                onClick={() => {
                  setFieldId(undefined);
                  setTextValue('');
                  setMultiValue([]);
                  setError(undefined);
                }}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              <FilterIcon className="h-4 w-4 shrink-0 text-neutral3" />
              <span className="text-ui-sm text-neutral3">{`${selectedField.label} · is`}</span>
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
              {fields.length > 0 ? (
                fields.map(f => {
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
                    <button
                      key={f.id}
                      type="button"
                      role="menuitem"
                      data-filter-item=""
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-md transition-colors',
                        'focus:bg-surface4 focus:text-neutral6 focus:outline-none',
                        used
                          ? 'cursor-not-allowed text-neutral2 opacity-70'
                          : 'text-neutral4 hover:bg-surface4 hover:text-neutral6',
                      )}
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
                        <span className="ml-auto text-neutral3">In use</span>
                      ) : (
                        <PlusIcon className="ml-auto h-4 w-4 text-neutral3 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-1.5 text-ui-sm text-neutral3">No matching property.</div>
              )}
            </div>
          )}

          {selectedField && selectedField.kind === 'text' && (
            <Input
              ref={textInputRef}
              size="md"
              value={textValue}
              onChange={e => {
                setTextValue(e.target.value);
                setError(undefined);
              }}
              placeholder={selectedField.placeholder ?? `Enter ${selectedField.label}`}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
              }}
            />
          )}

          {selectedField && selectedField.kind === 'multi-select' && (
            <MultiCombobox
              options={selectedField.options ?? []}
              value={multiValue}
              onValueChange={v => {
                setMultiValue(v);
                setError(undefined);
              }}
              placeholder={selectedField.placeholder ?? `Choose ${selectedField.label}`}
              searchPlaceholder={`Search ${selectedField.label.toLowerCase()}...`}
              emptyText={selectedField.emptyText ?? 'No option found.'}
              size="md"
            />
          )}

          {error && <div className="text-ui-sm text-red-500">{error}</div>}

          {selectedField && selectedField.kind !== 'pick-multi' && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" size="md" onClick={commit}>
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
  onChange: (fieldId: string, value: string | string[] | undefined) => void;
  open: boolean;
  onToggle: (fieldId: string) => void;
  onClose: () => void;
};

/**
 * A property-picker menu item that opens a separate Radix popover (portaled to
 * the side) with a radio group (single-select) or checkbox list (multi-select,
 * `field.multi === true`). Open/close is driven by explicit click / keyboard
 * press; the panel only closes when the user clicks outside, presses Escape,
 * or clicks the row again to toggle it off.
 */
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
        <button
          type="button"
          role="menuitem"
          data-filter-item=""
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 transition-colors',
            'focus:bg-surface4 focus:text-neutral6 focus:outline-none',
          )}
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
          {open && <ChevronLeftIcon className="h-4 w-4 text-neutral3 shrink-0" />}
          <span className="truncate">{field.label}</span>
          {!open && <ChevronRightIcon className="h-4 w-4 ml-auto text-neutral3 shrink-0" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side="right"
        align="start"
        sideOffset={8}
        className="w-64 p-2"
        onOpenAutoFocus={e => e.preventDefault()}
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
