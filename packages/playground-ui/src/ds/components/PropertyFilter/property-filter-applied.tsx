import { LockIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { ButtonsGroup, ButtonsGroupText } from '../ButtonsGroup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip';
import { PickMultiPanel } from './pick-multi-panel';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';

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
  /**
   * Field ids whose pills must remain visible and read-only — value stays
   * displayed but cannot be edited or removed. Use when an upstream context
   * (e.g. agent-scoped traces tab) pre-applies a filter that the user must
   * not be able to clear.
   */
  lockedFieldIds?: readonly string[];
  /** Tooltip content shown on hover/focus of any locked pill. */
  lockedTooltipContent?: ReactNode;
};

function stringifyTokenValue(value: string | string[]) {
  if (Array.isArray(value)) return value.length === 0 ? 'Any' : value.join(', ');
  return value;
}

const DEFAULT_LOCKED_TOOLTIP = 'This filter is set by the current context and cannot be removed here.';

function lookupOptionLabel(field: PropertyFilterField, value: string | string[]): string {
  if (field.kind === 'pick-multi' && field.options) {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Any';
      return value.map(v => field.options.find(o => o.value === v)?.label ?? v).join(', ');
    }
    return field.options.find(o => o.value === value)?.label ?? value;
  }
  return stringifyTokenValue(value);
}

type LockedTokenPillProps = {
  field: PropertyFilterField;
  value: string | string[];
  tooltipContent: ReactNode;
};

function LockedTokenPill({ field, value, tooltipContent }: LockedTokenPillProps) {
  const display = lookupOptionLabel(field, value);
  const lockA11yLabel = `${field.label} filter is locked by context`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ButtonsGroup
            spacing="close"
            data-locked-field-id={field.id}
            data-property-filter-pill="locked"
            tabIndex={0}
            aria-label={lockA11yLabel}
          >
            <ButtonsGroupText size="md">{field.label}</ButtonsGroupText>
            <ButtonsGroupText size="md">is</ButtonsGroupText>
            <ButtonsGroupText size="md">{display}</ButtonsGroupText>
            <ButtonsGroupText size="md">
              <LockIcon />
            </ButtonsGroupText>
          </ButtonsGroup>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
    <ButtonsGroup spacing="close">
      <ButtonsGroupText size="md">{field.label}</ButtonsGroupText>
      <ButtonsGroupText size="md">is</ButtonsGroupText>
      <Input
        ref={inputRef}
        size="md"
        disabled={disabled}
        value={draft}
        placeholder={field.placeholder ?? `Enter ${field.label}`}
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
        size="md"
        onMouseDown={e => e.preventDefault()}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </ButtonsGroup>
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
    <ButtonsGroup spacing="close">
      <ButtonsGroupText size="md">{field.label}</ButtonsGroupText>
      <ButtonsGroupText size="md">is</ButtonsGroupText>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" disabled={disabled} size="md">
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
        size="md"
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </ButtonsGroup>
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
  lockedFieldIds,
  lockedTooltipContent = DEFAULT_LOCKED_TOOLTIP,
}: PropertyFilterAppliedProps) {
  if (tokens.length === 0) return null;

  const lockedSet = new Set(lockedFieldIds ?? []);

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

        if (lockedSet.has(token.fieldId)) {
          return (
            <LockedTokenPill
              key={`${token.fieldId}-${index}`}
              field={field}
              value={token.value}
              tooltipContent={lockedTooltipContent}
            />
          );
        }

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
          <ButtonsGroup spacing="close" key={`${token.fieldId}-${index}`}>
            <ButtonsGroupText size="md">{field.label}</ButtonsGroupText>
            <ButtonsGroupText size="md">is</ButtonsGroupText>
            <ButtonsGroupText size="md">{stringifyTokenValue(token.value)}</ButtonsGroupText>
            <Button
              type="button"
              disabled={disabled}
              size="md"
              aria-label={`Remove ${field.label} filter`}
              onClick={() => removeTokenAt(index)}
            >
              <XIcon />
            </Button>
          </ButtonsGroup>
        );
      })}
    </div>
  );
}
