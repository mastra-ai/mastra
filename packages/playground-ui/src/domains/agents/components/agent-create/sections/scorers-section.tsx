'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import { Section, RemovableBadge } from '@/domains/cms';
import { JudgeIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import type { AgentFormValues } from '../../create-agent/form-validation';

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
  sampling?: ScoringSamplingConfig;
}

export function ScorersSection({ control, error }: ScorersSectionProps) {
  const { data: scorers, isLoading } = useScorers();

  const options = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      value: id,
      label: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  return (
    <Section title={<Section.Title icon={<JudgeIcon className="text-neutral3" />}>Scorers</Section.Title>}>
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
              // Preserve existing config or create empty one
              newScorers[id] = selectedScorers[id] || {};
            }
            field.onChange(newScorers);
          };

          const handleSamplingChange = (scorerId: string, samplingConfig: ScoringSamplingConfig | undefined) => {
            field.onChange({
              ...selectedScorers,
              [scorerId]: { sampling: samplingConfig },
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
                <div className="flex flex-wrap gap-1.5">
                  {selectedOptions.map(scorer => (
                    <RemovableBadge
                      key={scorer.value}
                      icon={<JudgeIcon className="text-neutral3" />}
                      onRemove={() => handleRemove(scorer.value)}
                    >
                      {scorer.label}
                    </RemovableBadge>
                  ))}
                </div>
              )}
              {/* Sampling configuration for selected scorers */}
              {selectedOptions.length > 0 && (
                <div className="flex flex-col gap-2 mt-2 pl-3 border-l-2 border-border1">
                  {selectedOptions.map(scorer => (
                    <ScorerSamplingConfig
                      key={scorer.value}
                      scorerId={scorer.value}
                      scorerName={scorer.label}
                      samplingConfig={selectedScorers[scorer.value]?.sampling}
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
    </Section>
  );
}

interface ScorerSamplingConfigProps {
  scorerId: string;
  scorerName: string;
  samplingConfig?: ScoringSamplingConfig;
  onSamplingChange: (config: ScoringSamplingConfig | undefined) => void;
  onRemove: () => void;
}

function ScorerSamplingConfig({
  scorerId,
  scorerName,
  samplingConfig,
  onSamplingChange,
  onRemove,
}: ScorerSamplingConfigProps) {
  const samplingType = samplingConfig?.type || 'none';

  const handleTypeChange = (type: string) => {
    if (type === 'none') {
      onSamplingChange(undefined);
    } else if (type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate: 0.1 }); // Default 10%
    } else if (type === 'count') {
      onSamplingChange({ type: 'count', count: 10 }); // Default 10 samples
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
    <div className="flex flex-col gap-2 p-2 bg-surface2 rounded-md border border-border1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-icon6">{scorerName}</span>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-icon3 hover:text-accent2"
          aria-label={`Remove ${scorerName}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

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
