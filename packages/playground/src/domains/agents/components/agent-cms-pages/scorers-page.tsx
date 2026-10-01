import { EntityName, EntityDescription, EntityContent, Entity } from '@mastra/playground-ui/components/Entity';
import { Field, FieldItem, FieldLabel, Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Section, SubSectionRoot } from '@mastra/playground-ui/components/Section';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { JudgeIcon } from '@mastra/playground-ui/icons/JudgeIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
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
      label: scorer.scorer?.config?.name || id,
      description: scorer.scorer?.config?.description || '',
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
      <div className="flex flex-col gap-4">
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

          <SearchInput label="Search scorers" placeholder="Search scorers" value={search} onValueChange={setSearch} />

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(scorer => {
                const isSelected = selectedScorerIds.includes(scorer.value);
                const isDisabled = readOnly || !isSelected;

                return (
                  <div key={scorer.value} className="flex flex-col">
                    <Entity className="bg-background">
                      <EntityContent>
                        <EntityName>{scorer.label}</EntityName>
                        <EntityDescription>
                          <input
                            type="text"
                            disabled={isDisabled}
                            className={cn(
                              'block w-full appearance-none border border-transparent bg-transparent text-muted-foreground',
                              !isDisabled && 'border-dashed border-border',
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
  samplingConfig?: ScorerConfig['sampling'];
  onSamplingChange: (config: ScorerConfig['sampling'] | undefined) => void;
  readOnly?: boolean;
}

function ScorerConfigPanel({ samplingConfig, onSamplingChange, readOnly = false }: ScorerConfigPanelProps) {
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
        <Field disabled={readOnly}>
          <Fieldset className="gap-2" render={<RadioGroup value={samplingType} onValueChange={handleTypeChange} />}>
            <FieldsetLegend className="text-muted-foreground">Sampling</FieldsetLegend>
            <FieldItem>
              <RadioGroupItem value="none" />
              <FieldLabel>None (evaluate all)</FieldLabel>
            </FieldItem>
            <FieldItem>
              <RadioGroupItem value="ratio" />
              <FieldLabel>Ratio (percentage)</FieldLabel>
            </FieldItem>
          </Fieldset>
        </Field>

        {samplingType === 'ratio' && (
          <Field disabled={readOnly} className="mt-2 gap-1.5">
            <FieldLabel>Sample Rate (0-1)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={samplingConfig?.rate ?? 0.1}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="h-8"
            />
          </Field>
        )}
      </div>
    </div>
  );
}
