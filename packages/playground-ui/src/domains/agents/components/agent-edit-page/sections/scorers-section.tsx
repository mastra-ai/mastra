import { useMemo, useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
import { Trash2, ChevronRight } from 'lucide-react';

import { Section } from '@/domains/cms';
import { JudgeIcon, Icon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { IconButton } from '@/ds/components/IconButton';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import type { AgentFormValues } from '../utils/form-validation';

interface ScorersSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

interface ScoringSamplingConfig {
  type: 'ratio' | 'count';
  rate?: number;
  count?: number;
}

interface ScorerConfig {
  description?: string;
  sampling?: ScoringSamplingConfig;
}

export function ScorersSection({ control, error }: ScorersSectionProps) {
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
    <div className="rounded-md border border-border1 bg-surface2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full p-3 bg-surface3">
          <ChevronRight className="h-4 w-4 text-icon3" />
          <Section.Title icon={<JudgeIcon className="text-neutral3" />}>
            Scorers{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
          </Section.Title>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 border-t border-border1">
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

                const handleSamplingChange = (scorerId: string, samplingConfig: ScoringSamplingConfig | undefined) => {
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
                  <div className="flex flex-col gap-2">
                    <MultiCombobox
                      options={options}
                      value={selectedIds}
                      onValueChange={handleValueChange}
                      placeholder="Select scorers..."
                      searchPlaceholder="Search scorers..."
                      emptyText="No scorers available"
                      disabled={isLoading}
                      error={error}
                      variant="light"
                    />
                    {selectedOptions.length > 0 && (
                      <div className="flex flex-col gap-3 mt-2">
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
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface ScorerConfigPanelProps {
  scorerId: string;
  scorerName: string;
  description: string;
  samplingConfig?: ScoringSamplingConfig;
  onDescriptionChange: (description: string) => void;
  onSamplingChange: (config: ScoringSamplingConfig | undefined) => void;
  onRemove: () => void;
}

function ScorerConfigPanel({
  scorerId,
  scorerName,
  description,
  samplingConfig,
  onDescriptionChange,
  onSamplingChange,
  onRemove,
}: ScorerConfigPanelProps) {
  const samplingType = samplingConfig?.type || 'none';

  const handleTypeChange = (type: string) => {
    if (type === 'none') {
      onSamplingChange(undefined);
    } else if (type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate: 0.1 });
    } else if (type === 'count') {
      onSamplingChange({ type: 'count', count: 10 });
    }
  };

  const handleRateChange = (rate: number) => {
    if (samplingConfig?.type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate });
    }
  };

  const handleCountChange = (count: number) => {
    if (samplingConfig?.type === 'count') {
      onSamplingChange({ type: 'count', count });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size="sm">
            <JudgeIcon className="text-neutral3" />
          </Icon>
          <span className="text-xs font-medium text-icon6">{scorerName}</span>
        </div>
        <IconButton tooltip={`Remove ${scorerName}`} onClick={onRemove} variant="ghost" size="sm">
          <Trash2 />
        </IconButton>
      </div>

      <Textarea
        id={`description-${scorerId}`}
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Custom description for this scorer..."
        className="min-h-[40px] text-xs bg-surface3 border-dashed px-2 py-1"
        size="sm"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`sampling-type-${scorerId}`} className="text-xs text-icon4">
          Sampling
        </Label>
        <RadioGroup
          id={`sampling-type-${scorerId}`}
          value={samplingType}
          onValueChange={handleTypeChange}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="none" id={`${scorerId}-none`} />
            <Label htmlFor={`${scorerId}-none`} className="text-sm text-icon5 cursor-pointer">
              None (evaluate all)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ratio" id={`${scorerId}-ratio`} />
            <Label htmlFor={`${scorerId}-ratio`} className="text-sm text-icon5 cursor-pointer">
              Ratio (percentage)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="count" id={`${scorerId}-count`} />
            <Label htmlFor={`${scorerId}-count`} className="text-sm text-icon5 cursor-pointer">
              Count (fixed number)
            </Label>
          </div>
        </RadioGroup>

        {samplingType === 'ratio' && (
          <div className="flex flex-col gap-1.5 mt-1">
            <Label htmlFor={`rate-${scorerId}`} className="text-xs text-icon4">
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
            />
          </div>
        )}

        {samplingType === 'count' && (
          <div className="flex flex-col gap-1.5 mt-1">
            <Label htmlFor={`count-${scorerId}`} className="text-xs text-icon4">
              Sample Count
            </Label>
            <Input
              id={`count-${scorerId}`}
              type="number"
              min="1"
              step="1"
              value={samplingConfig?.count ?? 10}
              onChange={e => handleCountChange(parseInt(e.target.value, 10))}
              className="h-8"
            />
          </div>
        )}
      </div>
    </div>
  );
}
