import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import {
  Field,
  FieldError,
  FieldItem,
  FieldLabel,
  Fieldset,
  FieldsetLegend,
} from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { JudgeIcon } from '@mastra/playground-ui/icons/JudgeIcon';
import { Trash2, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Control } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import type { AgentFormValues, ScorerConfig } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

interface ScorersSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
  readOnly?: boolean;
}

export function ScorersSection({ control, error, readOnly = false }: ScorersSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: scorers, isLoading } = useScorers();
  const selectedScorers = useWatch({ control, name: 'scorers' });
  const count = Object.keys(selectedScorers || {}).length;

  const options = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      value: id,
      label: scorer.scorer?.config?.name || id,
      description: scorer.scorer?.config?.description || '',
    }));
  }, [scorers]);

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  return (
    <div className="rounded-md border border-border bg-background">
      <Controller
        name="scorers"
        control={control}
        render={({ field }) => {
          const selectedScorers = field.value || {};
          const selectedIds = Object.keys(selectedScorers);
          const selectedOptions = options.filter(opt => selectedIds.includes(opt.value));

          const handleValueChange = (newIds: string[]) => {
            const newScorers: Record<string, ScorerConfig> = {};
            for (const id of newIds) {
              newScorers[id] = selectedScorers[id] || {
                description: getOriginalDescription(id),
              };
            }
            field.onChange(newScorers);
          };

          const handleDescriptionChange = (scorerId: string, description: string) => {
            field.onChange({
              ...selectedScorers,
              [scorerId]: { ...selectedScorers[scorerId], description },
            });
          };

          const handleSamplingChange = (scorerId: string, samplingConfig: ScorerConfig['sampling'] | undefined) => {
            field.onChange({
              ...selectedScorers,
              [scorerId]: { ...selectedScorers[scorerId], sampling: samplingConfig },
            });
          };

          const handleRemove = (scorerId: string) => {
            const newScorers = { ...selectedScorers };
            delete newScorers[scorerId];
            field.onChange(newScorers);
          };

          return (
            <>
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-between bg-card p-3">
                  <CollapsibleTrigger className="flex w-full items-center gap-1">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <SectionTitle icon={<JudgeIcon className="text-muted-foreground" />}>
                      Scorers{count > 0 && <span className="text-muted-foreground">({count})</span>}
                    </SectionTitle>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="border-t border-border p-3">
                    <div className="flex flex-col gap-2">
                      <Field invalid={Boolean(error)}>
                        <Combobox
                          multiple
                          aria-label="Scorers"
                          options={options}
                          value={selectedIds}
                          onValueChange={handleValueChange}
                          placeholder="Select scorers..."
                          searchPlaceholder="Search scorers..."
                          emptyText="No scorers available"
                          disabled={isLoading || readOnly}
                        />
                        <FieldError>{error}</FieldError>
                      </Field>

                      {selectedOptions.length > 0 && (
                        <div className="mt-2 flex flex-col gap-3">
                          {selectedOptions.map(scorer => (
                            <ScorerConfigPanel
                              key={scorer.value}
                              scorerId={scorer.value}
                              scorerName={scorer.label}
                              description={selectedScorers[scorer.value]?.description || ''}
                              samplingConfig={selectedScorers[scorer.value]?.sampling}
                              onDescriptionChange={desc => handleDescriptionChange(scorer.value, desc)}
                              onSamplingChange={config => handleSamplingChange(scorer.value, config)}
                              onRemove={() => handleRemove(scorer.value)}
                              readOnly={readOnly}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          );
        }}
      />
    </div>
  );
}

interface ScorerConfigPanelProps {
  scorerId: string;
  scorerName: string;
  description: string;
  samplingConfig?: ScorerConfig['sampling'];
  onDescriptionChange: (description: string) => void;
  onSamplingChange: (config: ScorerConfig['sampling'] | undefined) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

function ScorerConfigPanel({
  scorerId,
  scorerName,
  description,
  samplingConfig,
  onDescriptionChange,
  onSamplingChange,
  onRemove,
  readOnly = false,
}: ScorerConfigPanelProps) {
  const samplingType = samplingConfig?.type || 'none';

  const handleTypeChange = (type: string) => {
    if (type === 'none') {
      onSamplingChange(undefined);
    } else if (type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate: 0.1 });
    }
  };

  const handleRateChange = (rate: number) => {
    if (samplingConfig?.type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size="xs">
            <JudgeIcon className="text-muted-foreground" />
          </Icon>
          <span className="text-column text-foreground">{scorerName}</span>
        </div>
        {!readOnly && (
          <Button type="button" tooltip={`Remove ${scorerName}`} onClick={onRemove} variant="ghost" size="icon-sm">
            <Trash2 />
          </Button>
        )}
      </div>

      <Textarea
        id={`description-${scorerId}`}
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Custom description for this scorer..."
        className="min-h-[40px] border-dashed bg-card px-2 py-1 text-caption"
        size="sm"
        disabled={readOnly}
      />

      <div className="flex flex-col gap-2">
        <Field>
          <Fieldset
            className="gap-2"
            render={<RadioGroup value={samplingType} onValueChange={handleTypeChange} disabled={readOnly} />}
          >
            <FieldsetLegend className="text-muted-foreground">Sampling</FieldsetLegend>
            <FieldItem>
              <RadioGroupItem value="none" disabled={readOnly} />
              <FieldLabel className="cursor-pointer">None (evaluate all)</FieldLabel>
            </FieldItem>
            <FieldItem>
              <RadioGroupItem value="ratio" disabled={readOnly} />
              <FieldLabel className="cursor-pointer">Ratio (percentage)</FieldLabel>
            </FieldItem>
          </Fieldset>
        </Field>

        {samplingType === 'ratio' && (
          <Field className="mt-1 gap-1.5">
            <FieldLabel className="text-muted-foreground">Sample Rate (0-1)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={samplingConfig?.rate ?? 0.1}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="h-8"
              disabled={readOnly}
            />
          </Field>
        )}
      </div>
    </div>
  );
}
