import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
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
      label: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  return (
    <div className="border-border1 bg-surface2 rounded-md border">
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
                <div className="bg-surface3 flex items-center justify-between p-3">
                  <CollapsibleTrigger className="flex w-full items-center gap-1">
                    <ChevronRight className="text-neutral3 h-4 w-4" />
                    <SectionTitle icon={<JudgeIcon className="text-neutral3" />}>
                      Scorers{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
                    </SectionTitle>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="border-border1 border-t p-3">
                    <div className="flex flex-col gap-2">
                      <Combobox
                        multiple
                        options={options}
                        value={selectedIds}
                        onValueChange={handleValueChange}
                        placeholder="Select scorers..."
                        searchPlaceholder="Search scorers..."
                        emptyText="No scorers available"
                        disabled={isLoading || readOnly}
                        error={error}
                      />

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
          <Icon size="sm">
            <JudgeIcon className="text-neutral3" />
          </Icon>
          <span className="text-neutral6 text-xs font-medium">{scorerName}</span>
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
        className="bg-surface3 min-h-[40px] border-dashed px-2 py-1 text-xs"
        size="sm"
        disabled={readOnly}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`sampling-type-${scorerId}`} className="text-neutral4 text-xs">
          Sampling
        </Label>
        <RadioGroup
          id={`sampling-type-${scorerId}`}
          value={samplingType}
          onValueChange={handleTypeChange}
          className="flex flex-col gap-2"
          disabled={readOnly}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="none" id={`${scorerId}-none`} disabled={readOnly} />
            <Label htmlFor={`${scorerId}-none`} className="text-neutral5 cursor-pointer text-sm">
              None (evaluate all)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ratio" id={`${scorerId}-ratio`} disabled={readOnly} />
            <Label htmlFor={`${scorerId}-ratio`} className="text-neutral5 cursor-pointer text-sm">
              Ratio (percentage)
            </Label>
          </div>
        </RadioGroup>

        {samplingType === 'ratio' && (
          <div className="mt-1 flex flex-col gap-1.5">
            <Label htmlFor={`rate-${scorerId}`} className="text-neutral4 text-xs">
              Sample Rate (0-1)
            </Label>
            <Input
              id={`rate-${scorerId}`}
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={samplingConfig?.rate ?? 0.1}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="h-8"
              disabled={readOnly}
            />
          </div>
        )}
      </div>
    </div>
  );
}
