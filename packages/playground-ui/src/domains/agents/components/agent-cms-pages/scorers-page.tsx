import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';
import { JudgeIcon, Icon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { IconButton } from '@/ds/components/IconButton';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

interface ScoringSamplingConfig {
  type: 'ratio';
  rate?: number;
}

interface ScorerConfig {
  description?: string;
  sampling?: ScoringSamplingConfig;
}

export function ScorersPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
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
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Scorers"
          subtitle={`Configure scorers for evaluating agent responses.${count > 0 ? ` (${count} selected)` : ''}`}
          icon={<JudgeIcon className="text-neutral3" />}
        />

        <Controller
          name="scorers"
          control={control}
          render={({ field }) => {
            const currentScorers = field.value || {};
            const selectedIds = Object.keys(currentScorers);
            const selectedOptions = options.filter(opt => selectedIds.includes(opt.value));

            const handleValueChange = (newIds: string[]) => {
              const newScorers: Record<string, ScorerConfig> = {};
              for (const id of newIds) {
                newScorers[id] = currentScorers[id] || {
                  description: getOriginalDescription(id),
                };
              }
              field.onChange(newScorers);
            };

            const handleDescriptionChange = (scorerId: string, description: string) => {
              field.onChange({
                ...currentScorers,
                [scorerId]: { ...currentScorers[scorerId], description },
              });
            };

            const handleSamplingChange = (scorerId: string, samplingConfig: ScoringSamplingConfig | undefined) => {
              field.onChange({
                ...currentScorers,
                [scorerId]: { ...currentScorers[scorerId], sampling: samplingConfig },
              });
            };

            const handleRemove = (scorerId: string) => {
              const newScorers = { ...currentScorers };
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
                  disabled={isLoading || readOnly}
                  variant="light"
                />
                {selectedOptions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2">
                    {selectedOptions.map(scorer => (
                      <ScorerConfigPanel
                        key={scorer.value}
                        scorerId={scorer.value}
                        scorerName={scorer.label}
                        description={currentScorers[scorer.value]?.description || ''}
                        samplingConfig={currentScorers[scorer.value]?.sampling}
                        onDescriptionChange={desc => handleDescriptionChange(scorer.value, desc)}
                        onSamplingChange={config => handleSamplingChange(scorer.value, config)}
                        onRemove={() => handleRemove(scorer.value)}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </ScrollArea>
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
          <span className="text-xs font-medium text-icon6">{scorerName}</span>
        </div>
        {!readOnly && (
          <IconButton tooltip={`Remove ${scorerName}`} onClick={onRemove} variant="ghost" size="sm">
            <Trash2 />
          </IconButton>
        )}
      </div>

      <Textarea
        id={`description-${scorerId}`}
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Custom description for this scorer..."
        className="min-h-[40px] text-xs bg-surface3 border-dashed px-2 py-1"
        size="sm"
        disabled={readOnly}
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
          disabled={readOnly}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="none" id={`${scorerId}-none`} disabled={readOnly} />
            <Label htmlFor={`${scorerId}-none`} className="text-sm text-icon5 cursor-pointer">
              None (evaluate all)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ratio" id={`${scorerId}-ratio`} disabled={readOnly} />
            <Label htmlFor={`${scorerId}-ratio`} className="text-sm text-icon5 cursor-pointer">
              Ratio (percentage)
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
              disabled={readOnly}
            />
          </div>
        )}
      </div>
    </div>
  );
}
