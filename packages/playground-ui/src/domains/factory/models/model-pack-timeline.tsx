import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ModelPackEntryLabel } from './model-pack-entry-label';
import { ModelPackModelPicker } from './model-pack-model-picker';
import { MODEL_PACK_MODELS_MAX } from './model-packs';
import type { ModelPackModel, AvailableModelOption } from './model-packs';
import { PACK_FALLBACK_CLASS, PACK_MODEL_ROW_CLASS } from './pack-layout';
import { THINKING_LEVEL_LABELS } from './thinking-levels';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';

import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';
import { IconDotGrid1x3Horizontal } from '@/ds/icons/central/IconDotGrid1x3Horizontal';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { cn } from '@/utils/cn';

const EMPTY_CATALOG: AvailableModelOption[] = [];

function focusModelPicker(item: HTMLLIElement | null) {
  item?.querySelector('button')?.focus();
}

interface ModelPackTimelineProps {
  entries: ModelPackModel[];
  models?: AvailableModelOption[];
  disabled?: boolean;
  onChange?: (entries: ModelPackModel[]) => void | Promise<unknown>;
  renderProviderIcon?: (provider: string) => ReactNode;
}

export function ModelPackTimeline({
  entries,
  models = EMPTY_CATALOG,
  disabled = false,
  onChange,
  renderProviderIcon,
}: ModelPackTimelineProps) {
  const occupiedIds = useMemo(() => new Set(entries.map(entry => entry.modelId)), [entries]);
  const addLabel = entries.length ? 'Add model' : 'Choose a model';
  const [focusIndex, setFocusIndex] = useState<number>();

  return (
    <div className="min-w-0">
      {entries.length > 0 && (
        <ol aria-label="Models in this pack">
          {entries.map((entry, index) => {
            const label = index === 0 ? 'Primary model' : `Fallback ${index}`;
            const update = (next: ModelPackModel) => onChange?.(entries.with(index, next));
            const move = (target: number) => {
              const other = entries[target];
              if (!other) return;
              void onChange?.(entries.with(index, other).with(target, entry));
            };

            return (
              <li
                key={label}
                ref={index === focusIndex ? focusModelPicker : undefined}
                className={cn('group/model relative min-w-0', index > 0 && PACK_FALLBACK_CLASS)}
              >
                {index > 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-s-0 top-0 h-1/2 w-2 rounded-es-md border-s border-b border-border-strong"
                  />
                )}
                {index > 0 && index < entries.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 inset-s-0 w-px bg-border-strong"
                  />
                )}
                {onChange ? (
                  <div className="flex min-w-0 items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <ModelPackModelPicker
                        label={label}
                        entry={entry}
                        models={models}
                        occupiedIds={occupiedIds}
                        onChange={update}
                        disabled={disabled}
                      />
                    </div>
                    {entries.length > 1 && (
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${label} actions`}
                          className="pointer-fine:opacity-0 pointer-fine:group-focus-within/model:opacity-100 pointer-fine:group-hover/model:opacity-100 pointer-fine:aria-expanded:opacity-100"
                          tooltip={`${label} actions`}
                          disabled={disabled}
                        >
                          <IconDotGrid1x3Horizontal />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item disabled={index === 0} onClick={() => move(index - 1)}>
                            <IconArrowUp /> Move up
                          </DropdownMenu.Item>
                          <DropdownMenu.Item disabled={index === entries.length - 1} onClick={() => move(index + 1)}>
                            <IconArrowDown /> Move down
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            variant="destructive"
                            onClick={() => onChange(entries.filter((_, at) => at !== index))}
                          >
                            <TrashIcon /> Remove model
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    )}
                  </div>
                ) : (
                  <div className={PACK_MODEL_ROW_CLASS}>
                    <span className="sr-only">{label}: </span>
                    <ModelPackEntryLabel entry={entry} renderProviderIcon={renderProviderIcon} />
                    <span className="sr-only">, thinking: {THINKING_LEVEL_LABELS[entry.thinkingLevel]}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {onChange && entries.length < MODEL_PACK_MODELS_MAX && (
        <ModelPackModelPicker
          label={addLabel}
          models={models}
          occupiedIds={occupiedIds}
          onChange={entry => {
            if (entries.length + 1 === MODEL_PACK_MODELS_MAX) setFocusIndex(entries.length);
            return onChange([...entries, entry]);
          }}
          disabled={disabled}
        />
      )}
    </div>
  );
}
