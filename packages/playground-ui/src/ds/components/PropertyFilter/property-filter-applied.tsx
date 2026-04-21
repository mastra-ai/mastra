import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { PickMultiPanel } from './pick-multi-panel';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';
import { formElementSizes } from '@/ds/primitives/form-element';

export type PropertyFilterAppliedProps = {
  fields: PropertyFilterField[];
  tokens: PropertyFilterToken[];
  onTokensChange: (tokens: PropertyFilterToken[]) => void;
  disabled?: boolean;
  /**
   * Field id that was just added via the Creator — rendered pill auto-focuses
   * its input so the user can start typing immediately.
   */
  autoFocusFieldId?: string;
};

function stringifyTokenValue(value: string | string[]) {
  if (Array.isArray(value)) return value.length === 0 ? 'Any' : value.join(', ');
  return value;
}

const PILL_CLASS = 'inline-flex';
const SHARED_LABEL_OPERATOR_CLASSES = `${formElementSizes.md} border-y-2 border-border1 px-[.75em] text-neutral3 whitespace-nowrap flex items-center`;
const LABEL_CLASS = `${SHARED_LABEL_OPERATOR_CLASSES} text-ui-md rounded-l-lg border-l-2 border-r-1`;
const OPERATOR_CLASS = `${SHARED_LABEL_OPERATOR_CLASSES} text-ui-md `;
const REMOVE_CLASS = 'rounded-tl-none rounded-bl-none border-l-transparent';
const INPUT_CLASS = 'rounded-none';
const VALUE_BUTTON_CLASS = 'rounded-none';

type TextTokenPillProps = {
  field: Extract<PropertyFilterField, { kind: 'text' }>;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

function TextTokenPill({ field, value, onChange, onRemove, disabled, autoFocus }: TextTokenPillProps) {
  // Local draft keeps the caret stable when the URL round-trip trims the
  // stored value (e.g. trailing spaces). We only re-sync from the prop when
  // the external value is genuinely different from our current (trimmed) draft.
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft.trim() !== value) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={PILL_CLASS}>
      <span className={LABEL_CLASS}>{field.label}</span>
      <span className={OPERATOR_CLASS}>is</span>
      <Input
        ref={inputRef}
        size="md"
        disabled={disabled}
        value={draft}
        placeholder={field.placeholder ?? `Enter ${field.label}`}
        className={INPUT_CLASS}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          // Apply live — URL and traces query update on every keystroke.
          // Empty values persist as empty-value tokens so the pill stays visible.
          if (next.trim() !== value) onChange(next);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = draft.trim();
            if (trimmed !== value) onChange(trimmed);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <Button
        type="button"
        disabled={disabled}
        aria-label={`Remove ${field.label} filter`}
        className={REMOVE_CLASS}
        size="md"
        onMouseDown={e => e.preventDefault()}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}

type PickMultiTokenPillProps = {
  field: Extract<PropertyFilterField, { kind: 'pick-multi' }>;
  token: PropertyFilterToken;
  tokens: PropertyFilterToken[];
  onChange: (fieldId: string, value: string | string[] | undefined) => void;
  onRemove: () => void;
  disabled?: boolean;
};

function PickMultiTokenPill({ field, token, tokens, onChange, onRemove, disabled }: PickMultiTokenPillProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={PILL_CLASS}>
      <span className={LABEL_CLASS}>{field.label}</span>
      <span className={OPERATOR_CLASS}>is</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            size="md"
            className={VALUE_BUTTON_CLASS}
            // className="px-2.5 py-1.5 max-w-[20rem] truncate text-left hover:bg-surface5 hover:text-neutral6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stringifyTokenValue(token.value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-64 p-2" data-pick-multi-panel>
          <PickMultiPanel field={field} tokens={tokens} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        disabled={disabled}
        aria-label={`Remove ${field.label} filter`}
        className={REMOVE_CLASS}
        size="md"
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}

/**
 * Applied filter pills. Text/id-style tokens render with an always-active
 * input so the user can edit the value inline (and an empty token is valid —
 * it persists in the URL until the user explicitly removes it via ×).
 * Pick-multi tokens render with a clickable value that opens the same side
 * popover as the Filter Creator so the user can update selections in place.
 * Creation lives in a separate component (PropertyFilterCreator).
 */
export function PropertyFilterApplied({
  fields,
  tokens,
  onTokensChange,
  disabled,
  autoFocusFieldId,
}: PropertyFilterAppliedProps) {
  if (tokens.length === 0) return null;

  const replaceTokenAt = (index: number, next: PropertyFilterToken) => {
    const copy = [...tokens];
    copy[index] = next;
    onTokensChange(copy);
  };

  const removeTokenAt = (index: number) => {
    onTokensChange(tokens.filter((_, i) => i !== index));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tokens.map((token, index) => {
        const field = fields.find(f => f.id === token.fieldId);
        if (!field) return null;

        if (field.kind === 'text' && typeof token.value === 'string') {
          return (
            <TextTokenPill
              key={`${token.fieldId}-${index}`}
              field={field}
              value={token.value}
              disabled={disabled}
              autoFocus={autoFocusFieldId === token.fieldId}
              onChange={nextValue => replaceTokenAt(index, { fieldId: token.fieldId, value: nextValue })}
              onRemove={() => removeTokenAt(index)}
            />
          );
        }

        if (field.kind === 'pick-multi') {
          return (
            <PickMultiTokenPill
              key={`${token.fieldId}-${index}`}
              field={field}
              token={token}
              tokens={tokens}
              disabled={disabled}
              onChange={(fieldId, value) => {
                // Unselecting everything (empty array) keeps the pill alive in
                // a neutral state — the user explicitly removes it via ×. This
                // lets the page-level Reset neutralize values without dropping
                // the pill structure.
                if (value === undefined) {
                  removeTokenAt(index);
                  return;
                }
                replaceTokenAt(index, { fieldId, value });
              }}
              onRemove={() => removeTokenAt(index)}
            />
          );
        }

        return (
          <div key={`${token.fieldId}-${index}`} className={PILL_CLASS}>
            <span className={LABEL_CLASS}>{field.label}</span>
            <span className={OPERATOR_CLASS}>is</span>
            <span className="px-2.5 py-1.5 max-w-[20rem] truncate">{stringifyTokenValue(token.value)}</span>
            <Button
              type="button"
              disabled={disabled}
              size="md"
              aria-label={`Remove ${field.label} filter`}
              className={REMOVE_CLASS}
              onClick={() => removeTokenAt(index)}
            >
              <XIcon />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
