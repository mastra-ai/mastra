import { FACTORY_MODEL_FALLBACKS_MAX } from '@mastra/factory/model-fallbacks';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ModelCombobox } from '../../ModelCombobox';

function moved(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

function RowCaption({ children }: { children: string }) {
  return (
    <Txt as="p" variant="caption" className="text-destructive-foreground">
      {children}
    </Txt>
  );
}

export function FallbackModelsEditor({
  value,
  primaryModelId,
  models,
  disabled,
  error,
  onChange,
}: {
  value: string[];
  primaryModelId: string | undefined;
  models: AvailableModelOption[] | undefined;
  disabled?: boolean;
  error?: string;
  onChange(next: string[]): void;
}) {
  const baseId = useId();
  const addId = `${baseId}-add`;
  const rowId = (modelId: string) => `${baseId}-${modelId}`;
  const [announcement, setAnnouncement] = useState('');
  // Rows are keyed by model, so a reorder can move the focused node and blur it; focus lands once the row is in place.
  const focusTarget = useRef<{ elementId: string; modelId: string; index: number }>(undefined);
  const groupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (!target || value[target.index] !== target.modelId) return;
    focusTarget.current = undefined;
    document.getElementById(target.elementId)?.focus();
  }, [value]);

  const optionsFor = (current?: string) =>
    (models ?? []).filter(model => model.id === current || (model.id !== primaryModelId && !value.includes(model.id)));
  const accepts = (next: string) => Boolean(next) && next !== primaryModelId && !value.includes(next);
  const addCaption = !primaryModelId
    ? 'Pick a default model first'
    : value.length >= FACTORY_MODEL_FALLBACKS_MAX
      ? `Up to ${FACTORY_MODEL_FALLBACKS_MAX} fallbacks`
      : undefined;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const modelId = value[from];
    focusTarget.current = { elementId: `${rowId(modelId)}-${to < from ? 'up' : 'down'}`, modelId, index: to };
    onChange(moved(value, from, to));
    setAnnouncement(`${formatModelName(modelId)} moved to position ${to + 1}`);
  };

  const replace = (index: number, next: string) => {
    if (!accepts(next)) return;
    focusTarget.current = { elementId: rowId(next), modelId: next, index };
    onChange(value.map((existing, at) => (at === index ? next : existing)));
    setAnnouncement(`${formatModelName(next)} is now fallback ${index + 1}`);
  };

  const remove = (index: number) => {
    const neighbour = value[index + 1] ?? value[index - 1];
    (document.getElementById(neighbour ? rowId(neighbour) : addId) ?? groupRef.current)?.focus();
    onChange(value.filter((_, at) => at !== index));
    setAnnouncement(`${formatModelName(value[index])} removed`);
  };

  const add = (next: string) => {
    if (!accepts(next)) return;
    onChange([...value, next]);
    setAnnouncement(`${formatModelName(next)} added as fallback ${value.length + 1}`);
  };

  return (
    <div ref={groupRef} role="group" aria-label="Fallback models" tabIndex={-1} className="flex min-w-0 flex-col gap-2">
      <Txt as="p" variant="caption" tone="muted">
        If a session's model is rate-limited or out of credits, it continues on these models in order.
      </Txt>
      {value.length > 0 && (
        <ol className="flex flex-col gap-2">
          {value.map((id, index) => (
            <li key={id} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-1">
                <ModelCombobox
                  id={rowId(id)}
                  models={optionsFor(id)}
                  value={id}
                  onValueChange={next => replace(index, next)}
                  aria-label={`Fallback model ${index + 1}`}
                  size="sm"
                  className="min-w-0 flex-1"
                  disabled={disabled}
                />
                {value.length > 1 && (
                  <>
                    <Button
                      id={`${rowId(id)}-up`}
                      variant="ghost"
                      size="icon-sm"
                      tooltip={`Move fallback ${index + 1} up`}
                      aria-disabled={index === 0 || undefined}
                      disabled={disabled}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      id={`${rowId(id)}-down`}
                      variant="ghost"
                      size="icon-sm"
                      tooltip={`Move fallback ${index + 1} down`}
                      aria-disabled={index === value.length - 1 || undefined}
                      disabled={disabled}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  tooltip={`Remove fallback ${index + 1}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <TrashIcon />
                </Button>
              </div>
              {id === primaryModelId ? (
                <RowCaption>Already the default model</RowCaption>
              ) : (
                models &&
                !models.some(model => model.id === id) && (
                  <RowCaption>Not available with your current keys; skipped during runs</RowCaption>
                )
              )}
            </li>
          ))}
        </ol>
      )}
      {addCaption ? (
        <Txt as="p" variant="caption" tone="muted">
          {addCaption}
        </Txt>
      ) : (
        <div>
          <ModelCombobox
            id={addId}
            models={optionsFor()}
            value=""
            onValueChange={add}
            placeholder={
              <span className="flex items-center gap-1">
                <IconPlusMedium />
                Add fallback
              </span>
            }
            aria-label="Add fallback"
            variant="ghost"
            size="sm"
            showChevron={false}
            disabled={disabled}
          />
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error}
        </Txt>
      )}
    </div>
  );
}
