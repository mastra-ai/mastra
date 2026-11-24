import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import { MODEL_PACK_MODELS_MAX } from '@mastra/factory/model-packs';
import type { ModelPackModel } from '@mastra/factory/model-packs';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { ArrowDown, ArrowUp, Ellipsis } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ALL_THINKING_LEVEL_OPTIONS, THINKING_LEVEL_LABELS } from '../../../../chat/services/thinkingLevels';
import { ModelCombobox } from '../../ModelCombobox';

const EMPTY_CATALOG: AvailableModelOption[] = [];

interface ModelPackTimelineProps {
  entries: ModelPackModel[];
  models: AvailableModelOption[] | undefined;
  disabled: boolean;
  onChange?: (entries: ModelPackModel[]) => void;
}

export function ModelPackTimeline({ entries, models = EMPTY_CATALOG, disabled, onChange }: ModelPackTimelineProps) {
  const occupiedIds = useMemo(() => entries.map(entry => entry.modelId), [entries]);
  const addLabel = entries.length ? 'Add model' : 'Choose a model';

  return (
    <ol aria-label="Models in this pack" className="min-w-0">
      {entries.map((entry, index) => {
        const label = index === 0 ? 'Primary model' : `Fallback ${index}`;
        const update = (next: ModelPackModel) => onChange?.(entries.with(index, next));
        const move = (target: number) => {
          const reordered = [...entries];
          reordered[index] = reordered[target];
          reordered[target] = entry;
          onChange?.(reordered);
        };

        return (
          <PackStep key={label}>
            <Txt as="span" variant="meta" tone="muted" className="block pt-1">
              {label}
            </Txt>
            {onChange ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1">
                <ModelCombobox
                  models={models}
                  occupiedModelIds={occupiedIds}
                  value={entry.modelId}
                  onValueChange={modelId => modelId && modelId !== entry.modelId && update({ ...entry, modelId })}
                  aria-label={label}
                  size="sm"
                  variant="ghost"
                  showChevron
                  className="min-w-32 flex-1 justify-start"
                  disabled={disabled}
                />
                <div className="ml-auto flex items-center">
                  <Select
                    value={entry.thinkingLevel}
                    disabled={disabled}
                    onValueChange={value => {
                      const level = ALL_THINKING_LEVEL_OPTIONS.find(option => option.value === value)?.value;
                      if (level && level !== entry.thinkingLevel) update({ ...entry, thinkingLevel: level });
                    }}
                  >
                    <SelectTrigger size="sm" variant="ghost" aria-label={`${label} thinking`}>
                      {THINKING_LEVEL_LABELS[entry.thinkingLevel]}
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_THINKING_LEVEL_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {entries.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${label} actions`}
                        tooltip={`${label} actions`}
                        disabled={disabled}
                      >
                        <Ellipsis />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item disabled={index === 0} onClick={() => move(index - 1)}>
                          <ArrowUp /> Move up
                        </DropdownMenu.Item>
                        <DropdownMenu.Item disabled={index === entries.length - 1} onClick={() => move(index + 1)}>
                          <ArrowDown /> Move down
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
              </div>
            ) : (
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-1">
                <Txt as="span" variant="caption" className="min-w-0 wrap-break-word">
                  {formatModelName(entry.modelId)}
                </Txt>
                <Txt as="span" variant="caption" tone="muted">
                  {THINKING_LEVEL_LABELS[entry.thinkingLevel]}
                </Txt>
              </div>
            )}
          </PackStep>
        );
      })}
      {onChange && entries.length < MODEL_PACK_MODELS_MAX && (
        <PackStep add>
          <ModelCombobox
            models={models}
            occupiedModelIds={occupiedIds}
            value=""
            onValueChange={modelId =>
              modelId && onChange([...entries, { modelId, thinkingLevel: DEFAULT_THINKING_LEVEL }])
            }
            placeholder={addLabel}
            aria-label={addLabel}
            size="sm"
            variant="ghost"
            disabled={disabled}
          />
        </PackStep>
      )}
    </ol>
  );
}

function PackStep({ add, children }: { add?: boolean; children: ReactNode }) {
  return (
    <li className="group/step grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-1">
      <span aria-hidden="true" className="flex flex-col items-center self-stretch">
        <span className="bg-border-strong h-2.5 w-px shrink-0 group-first/step:invisible" />
        {add ? (
          <IconPlusMedium className="text-muted-foreground size-icon-sm -mt-1 shrink-0" />
        ) : (
          <span className="bg-muted-foreground size-2 shrink-0 rounded-full" />
        )}
        <span className="bg-border-strong w-px flex-1 group-last/step:invisible" />
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
