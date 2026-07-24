import { EntityName, EntityDescription, EntityContent, Entity } from '@mastra/playground-ui/components/Entity';
import { Input } from '@mastra/playground-ui/components/Input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Label } from '@mastra/playground-ui/components/Label';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Section, SubSectionRoot } from '@mastra/playground-ui/components/Section';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { JudgeIcon } from '@mastra/playground-ui/icons/JudgeIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import type { ScorerConfig } from '../../components/agent-edit-page/utils/form-validation';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { SectionHeader, DisplayConditionsDialog } from '@/domains/cms';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export function ScorersPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: scorers } = useScorers();
  const selectedScorers = useWatch({ control, name: 'scorers' });
  const variables = useWatch({ control, name: 'variables' });
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      value: id,
      label: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  const selectedScorerIds = Object.keys(selectedScorers || {});
  const count = selectedScorerIds.length;

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (scorerId: string) => {
    const isSet = selectedScorers?.[scorerId] !== undefined;
    if (isSet) {
      const next = { ...selectedScorers };
      delete next[scorerId];
      form.setValue('scorers', next, { shouldDirty: true });
    } else {
      form.setValue(
        'scorers',
        {
          ...selectedScorers,
          [scorerId]: { ...selectedScorers?.[scorerId], description: getOriginalDescription(scorerId) },
        },
        { shouldDirty: true },
      );
    }
  };

  const handleDescriptionChange = (scorerId: string, description: string) => {
    form.setValue(
      'scorers',
      {
        ...selectedScorers,
        [scorerId]: { ...selectedScorers?.[scorerId], description },
      },
      { shouldDirty: true },
    );
  };

  const handleSamplingChange = (scorerId: string, samplingConfig: ScorerConfig['sampling'] | undefined) => {
    form.setValue(
      'scorers',
      {
        ...selectedScorers,
        [scorerId]: { ...selectedScorers?.[scorerId], sampling: samplingConfig },
      },
      { shouldDirty: true },
    );
  };

  const handleRulesChange = (scorerId: string, rules: RuleGroup | undefined) => {
    form.setValue(
      'scorers',
      {
        ...selectedScorers,
        [scorerId]: { ...selectedScorers?.[scorerId], rules },
      },
      { shouldDirty: true },
    );
  };

  const filteredOptions = useMemo(() => {
    return options.filter(option => option.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Scorers"
            subtitle={`Configure scorers for evaluating agent responses.${count > 0 ? ` (${count} selected)` : ''}`}
          />
        </div>

        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Available Scorers" icon={<JudgeIcon />} />
          </Section.Header>

          <InputGroup variant="outline">
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search scorers"
              placeholder="Search scorers"
              onChange={event => setSearch(event.target.value)}
            />
          </InputGroup>

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(scorer => {
                const isSelected = selectedScorerIds.includes(scorer.value);
                const isDisabled = readOnly || !isSelected;

                return (
                  <div key={scorer.value} className="flex flex-col">
                    <Entity className="bg-surface2">
                      <EntityContent>
                        <EntityName>{scorer.label}</EntityName>
                        <EntityDescription>
                          <input
                            type="text"
                            disabled={isDisabled}
                            className={cn(
                              'border border-transparent appearance-none block w-full text-neutral3 bg-transparent',
                              !isDisabled && 'border-border1 border-dashed ',
                            )}
                            value={
                              isSelected
                                ? (selectedScorers?.[scorer.value]?.description ?? scorer.description)
                                : scorer.description
                            }
                            onChange={e => handleDescriptionChange(scorer.value, e.target.value)}
                          />

                          {isSelected && (
                            <div className="pt-2">
                              <ScorerConfigPanel
                                scorerId={scorer.value}
                                samplingConfig={selectedScorers?.[scorer.value]?.sampling}
                                onSamplingChange={config => handleSamplingChange(scorer.value, config)}
                                readOnly={readOnly}
                              />
                            </div>
                          )}
                        </EntityDescription>
                      </EntityContent>

                      {isSelected && !readOnly && (
                        <DisplayConditionsDialog
                          entityName={scorer.label}
                          schema={variables}
                          rules={selectedScorers?.[scorer.value]?.rules}
                          onRulesChange={rules => handleRulesChange(scorer.value, rules)}
                        />
                      )}

                      {!readOnly && (
                        <Switch checked={isSelected} onCheckedChange={() => handleValueChange(scorer.value)} />
                      )}
                    </Entity>
                  </div>
                );
              })}
            </div>
          )}
        </SubSectionRoot>
      </div>
    </ScrollArea>
  );
}

interface ScorerConfigPanelProps {
  scorerId: string;
  samplingConfig?: ScorerConfig['sampling'];
  onSamplingChange: (config: ScorerConfig['sampling'] | undefined) => void;
  readOnly?: boolean;
}

function ScorerConfigPanel({ scorerId, samplingConfig, onSamplingChange, readOnly = false }: ScorerConfigPanelProps) {
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
    <div>
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
            <Label htmlFor={`${scorerId}-none`} className="text-ui-xs text-neutral5 cursor-pointer">
              None (evaluate all)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ratio" id={`${scorerId}-ratio`} disabled={readOnly} />
            <Label htmlFor={`${scorerId}-ratio`} className="text-ui-xs text-neutral5 cursor-pointer">
              Ratio (percentage)
            </Label>
          </div>
        </RadioGroup>

        {samplingType === 'ratio' && (
          <div className="mt-2 flex flex-col gap-1.5">
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
