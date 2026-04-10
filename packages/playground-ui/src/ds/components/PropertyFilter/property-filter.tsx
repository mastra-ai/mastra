import { CheckIcon, ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/ds/components/Button/Button';
import { MultiCombobox } from '@/ds/components/Combobox/multi-combobox';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { Input } from '@/ds/components/Input';
import {
  formElementSizes,
  sharedFormElementDisabledStyle,
  sharedFormElementFocusStyle,
  sharedFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export type PropertyFilterOption = {
  label: string;
  value: string;
};

export type ClearableSingleSelectProps = {
  label: string;
  options: PropertyFilterOption[];
  value?: string;
  onValueChange: (value?: string) => void;
  disabled?: boolean;
};

export type PropertyFilterField = {
  id: string;
  label: string;
  kind: 'text' | 'multi-select';
  placeholder?: string;
  options?: PropertyFilterOption[];
  supportsSuggestions?: boolean;
  emptyText?: string;
};

export type PropertyFilterToken = {
  fieldId: string;
  value: string | string[];
};

export type PropertyFilterProps = {
  fields: PropertyFilterField[];
  tokens: PropertyFilterToken[];
  onTokensChange: (tokens: PropertyFilterToken[]) => void;
  loadSuggestions?: (fieldId: string, query: string) => Promise<PropertyFilterOption[]>;
  label?: string;
  disabled?: boolean;
};

function stringifyTokenValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(', ') : value;
}

function getSharedPrefix(values: string[]) {
  if (values.length === 0) return '';

  let prefix = values[0] ?? '';

  for (const value of values.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < value.length && prefix[index] === value[index]) {
      index += 1;
    }
    prefix = prefix.slice(0, index);

    if (!prefix) break;
  }

  return prefix;
}

export function ClearableSingleSelect({
  label,
  options,
  value,
  onValueChange,
  disabled,
}: ClearableSingleSelectProps) {
  const selected = options.find(option => option.value === value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="inputLike" size="md" disabled={disabled} className="justify-between min-w-[11rem]">
          <span className={cn('truncate', !selected && 'text-neutral3')}>{selected?.label ?? label}</span>
          <span className="flex items-center gap-2">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Clear ${label}`}
                className="text-neutral3 hover:text-neutral6 transition-colors"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onValueChange(undefined);
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  onValueChange(undefined);
                }}
              >
                <XIcon className="h-4 w-4" />
              </span>
            )}
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-[12rem]">
        {options.map(option => (
          <DropdownMenu.Item
            key={option.value}
            onSelect={() => {
              onValueChange(option.value);
            }}
          >
            <span className="truncate">{option.label}</span>
            {option.value === value && <CheckIcon className="ml-auto h-4 w-4" />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function PropertyFilter({
  fields,
  tokens,
  onTokensChange,
  loadSuggestions,
  label = 'Filter',
  disabled,
}: PropertyFilterProps) {
  const [open, setOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [fieldQuery, setFieldQuery] = useState('');
  const [draftTextValue, setDraftTextValue] = useState('');
  const [draftMultiValue, setDraftMultiValue] = useState<string[]>([]);
  const [draftError, setDraftError] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<PropertyFilterOption[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldSearchInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const selectedField = useMemo(() => fields.find(field => field.id === selectedFieldId), [fields, selectedFieldId]);

  const existingFieldIds = useMemo(() => new Set(tokens.map(token => token.fieldId)), [tokens]);
  const filteredFields = useMemo(() => {
    const normalizedQuery = fieldQuery.trim().toLowerCase();

    return fields.filter(field => {
      if (!normalizedQuery) return true;
      return field.label.toLowerCase().includes(normalizedQuery);
    });
  }, [fieldQuery, fields]);

  const resetDraft = useCallback(() => {
    setSelectedFieldId('');
    setFieldQuery('');
    setDraftTextValue('');
    setDraftMultiValue([]);
    setDraftError(undefined);
    setSuggestions([]);
    setIsLoadingSuggestions(false);
  }, []);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    resetDraft();
  }, [resetDraft]);

  useEffect(() => {
    if (!open) {
      resetDraft();
    }
  }, [open, resetDraft]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeAndReset();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAndReset();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeAndReset, open]);

  useEffect(() => {
    setDraftTextValue('');
    setDraftMultiValue([]);
    setDraftError(undefined);
    setSuggestions([]);
  }, [selectedFieldId]);

  useEffect(() => {
    if (!open) return;

    if (!selectedField) {
      fieldSearchInputRef.current?.focus();
      return;
    }

    if (selectedField.kind === 'text') {
      valueInputRef.current?.focus();
    }
  }, [open, selectedField]);

  const runSuggestionQuery = useDebouncedCallback(async (fieldId: string, query: string) => {
    if (!loadSuggestions) return;

    setIsLoadingSuggestions(true);
    try {
      const next = await loadSuggestions(fieldId, query);
      setSuggestions(next);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, 250);

  useEffect(() => {
    if (!selectedField || selectedField.kind !== 'text' || !selectedField.supportsSuggestions || !loadSuggestions) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      runSuggestionQuery.cancel();
      return;
    }

    void runSuggestionQuery(selectedField.id, draftTextValue);
    return () => runSuggestionQuery.cancel();
  }, [draftTextValue, loadSuggestions, runSuggestionQuery, selectedField]);

  const validateDraft = useCallback(() => {
    if (!selectedField) {
      return 'Choose a field first.';
    }

    if (existingFieldIds.has(selectedField.id)) {
      return `Remove the existing ${selectedField.label} filter before adding another.`;
    }

    if (selectedField.kind === 'text' && !draftTextValue.trim()) {
      return `Enter a value for ${selectedField.label}.`;
    }

    if (selectedField.kind === 'multi-select' && draftMultiValue.length === 0) {
      return `Choose at least one ${selectedField.label.toLowerCase()} value.`;
    }

    return undefined;
  }, [draftMultiValue.length, draftTextValue, existingFieldIds, selectedField]);

  const commitToken = useCallback(() => {
    const error = validateDraft();
    if (error) {
      setDraftError(error);
      return;
    }

    if (!selectedField) return;

    const nextToken: PropertyFilterToken =
      selectedField.kind === 'multi-select'
        ? { fieldId: selectedField.id, value: draftMultiValue }
        : { fieldId: selectedField.id, value: draftTextValue.trim() };

    onTokensChange([...tokens, nextToken]);
    closeAndReset();
  }, [closeAndReset, draftMultiValue, draftTextValue, onTokensChange, selectedField, tokens, validateDraft]);

  const removeToken = useCallback(
    (fieldId: string) => {
      onTokensChange(tokens.filter(token => token.fieldId !== fieldId));
    },
    [onTokensChange, tokens],
  );

  const selectedFieldOptions = selectedField?.options ?? [];
  const topSuggestion = suggestions[0];
  const sharedSuggestionPrefix = useMemo(() => getSharedPrefix(suggestions.map(option => option.value)), [suggestions]);

  const acceptSuggestion = useCallback((option: PropertyFilterOption) => {
    setDraftTextValue(option.value);
    setSuggestions([]);
    setDraftError(undefined);
    valueInputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 flex-wrap min-w-0">
      {tokens.map(token => {
        const field = fields.find(candidate => candidate.id === token.fieldId);
        if (!field) return null;

        return (
          <span
            key={token.fieldId}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-border1 bg-surface4 px-3 py-2 text-ui-sm text-neutral5',
            )}
          >
            <span className="text-neutral3">{field.label}</span>
            <span className="max-w-[20rem] truncate">{stringifyTokenValue(token.value)}</span>
            <button
              type="button"
              aria-label={`Remove ${field.label} filter`}
              className="text-neutral3 hover:text-neutral6 transition-colors"
              onClick={() => removeToken(token.fieldId)}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </span>
        );
      })}

      <div ref={containerRef} className="relative min-w-[18rem] max-w-full">
        <div
          className={cn(
            'flex items-center gap-2 border-2 rounded-lg px-[.75em]',
            formElementSizes.md,
            sharedFormElementStyle,
            sharedFormElementFocusStyle,
            sharedFormElementDisabledStyle,
            'min-w-[18rem] bg-surface2',
            disabled && 'pointer-events-none',
            draftError && 'border-error focus-within:border-error',
          )}
          onClick={() => {
            if (disabled) return;
            setOpen(true);
            if (!selectedField) {
              fieldSearchInputRef.current?.focus();
            } else if (selectedField.kind === 'text') {
              valueInputRef.current?.focus();
            }
          }}
        >
          <FilterIcon className="h-4 w-4 shrink-0 text-neutral3" />

          {!selectedField ? (
            <Input
              ref={fieldSearchInputRef}
              variant="unstyled"
              size="md"
              disabled={disabled}
              value={fieldQuery}
              onFocus={() => setOpen(true)}
              onChange={e => {
                setFieldQuery(e.target.value);
                setDraftError(undefined);
                if (!open) setOpen(true);
              }}
              placeholder={label}
              className="h-full min-w-0 flex-1 px-0 text-neutral5"
            />
          ) : (
            <>
              <span className="shrink-0 rounded-md bg-surface4 px-2 py-1 text-ui-xs text-neutral3">{selectedField.label}</span>

              {selectedField.kind === 'text' ? (
                <Input
                  ref={valueInputRef}
                  variant="unstyled"
                  size="md"
                  disabled={disabled}
                  value={draftTextValue}
                  onFocus={() => setOpen(true)}
                  onChange={e => {
                    setDraftTextValue(e.target.value);
                    setDraftError(undefined);
                    if (!open) setOpen(true);
                  }}
                  placeholder={selectedField.placeholder ?? `Enter ${selectedField.label}`}
                  className="h-full min-w-0 flex-1 px-0 text-neutral5"
                  onKeyDown={e => {
                    const shouldAcceptTopSuggestion =
                      selectedField.supportsSuggestions &&
                      !!topSuggestion &&
                      draftTextValue.trim() !== topSuggestion.value;
                    const canExtendSharedPrefix =
                      selectedField.supportsSuggestions &&
                      sharedSuggestionPrefix.length > draftTextValue.length &&
                      sharedSuggestionPrefix.startsWith(draftTextValue);

                    if (e.key === 'Tab' && canExtendSharedPrefix) {
                      e.preventDefault();
                      setDraftTextValue(sharedSuggestionPrefix);
                      setDraftError(undefined);
                      return;
                    }

                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (shouldAcceptTopSuggestion) {
                        acceptSuggestion(topSuggestion);
                        return;
                      }
                      commitToken();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-ui-md text-neutral3"
                  onClick={() => setOpen(true)}
                >
                  <span className="truncate">
                    {draftMultiValue.length > 0 ? draftMultiValue.join(', ') : selectedField.placeholder ?? `Choose ${selectedField.label}`}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 shrink-0" />
                </button>
              )}
            </>
          )}

          {selectedField && (
            <button
              type="button"
              aria-label={`Clear ${selectedField.label} draft`}
              className="shrink-0 text-neutral3 transition-colors hover:text-neutral6"
              onClick={event => {
                event.stopPropagation();
                setSelectedFieldId('');
                setDraftError(undefined);
                setOpen(true);
              }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full min-w-[22rem] max-w-[26rem] rounded-md border border-border1 bg-surface3 p-3 text-neutral5 shadow-md">
            <div className="grid gap-3">
              {!selectedField ? (
                <div className="rounded-lg border border-border1 bg-surface4/60 p-1 max-h-64 overflow-auto">
                  {filteredFields.length > 0 ? (
                    filteredFields.map(field => {
                      const isAlreadyUsed = existingFieldIds.has(field.id);

                      return (
                        <button
                          key={field.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-sm transition-colors',
                            isAlreadyUsed
                              ? 'cursor-not-allowed text-neutral2 opacity-70'
                              : 'text-neutral4 hover:bg-surface4 hover:text-neutral6',
                          )}
                          disabled={isAlreadyUsed}
                          onClick={() => {
                            setSelectedFieldId(field.id);
                            setDraftError(undefined);
                          }}
                        >
                          <FilterIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{field.label}</span>
                          {isAlreadyUsed && <span className="ml-auto text-ui-xs text-neutral3">Already used</span>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-2 py-1.5 text-ui-sm text-neutral3">No filter field found.</div>
                  )}
                </div>
              ) : (
                <>
                  {selectedField.kind === 'text' && selectedField.supportsSuggestions && (
                    <div className="rounded-lg border border-border1 bg-surface4/60 p-1">
                      {isLoadingSuggestions ? (
                        <div className="px-2 py-1.5 text-ui-sm text-neutral3">Loading suggestions...</div>
                      ) : suggestions.length > 0 ? (
                        suggestions.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-sm text-neutral4 hover:bg-surface4 hover:text-neutral6"
                            onClick={() => {
                              acceptSuggestion(option);
                            }}
                          >
                            <CheckIcon className="h-4 w-4 opacity-0" />
                            <span className="truncate">{option.label}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-ui-sm text-neutral3">
                          {draftTextValue.trim() ? 'No suggestions found.' : 'No suggestions available.'}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedField.kind === 'multi-select' && (
                    <div className="grid gap-1">
                      <span className="text-ui-sm text-neutral3">Values</span>
                      <MultiCombobox
                        options={selectedFieldOptions}
                        value={draftMultiValue}
                        onValueChange={value => {
                          setDraftMultiValue(value);
                          setDraftError(undefined);
                        }}
                        placeholder={selectedField.placeholder ?? `Choose ${selectedField.label}`}
                        searchPlaceholder={`Search ${selectedField.label.toLowerCase()}...`}
                        emptyText={selectedField.emptyText ?? 'No option found.'}
                        size="md"
                      />
                    </div>
                  )}
                </>
              )}

              {draftError && <div className="text-ui-sm text-red-500">{draftError}</div>}

              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="md" onClick={closeAndReset}>
                  Cancel
                </Button>
                <Button variant="outline" size="md" onClick={commitToken} disabled={!selectedField}>
                  Add filter
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
