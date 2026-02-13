import { useCallback, useMemo, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { ChevronRight, Ruler, Trash2, PlusIcon } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';
import { JudgeIcon, Icon } from '@/ds/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { IconButton } from '@/ds/components/IconButton';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Button } from '@/ds/components/Button';
import { SideDialog } from '@/ds/components/SideDialog';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import type { JsonSchema, RuleGroup } from '@/lib/rule-engine';
import { RuleBuilder, countLeafRules } from '@/lib/rule-engine';
import { cn } from '@/lib/utils';
import type { ScorerConfig } from '../../components/agent-edit-page/utils/form-validation';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function ScorersPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: scorers, isLoading } = useScorers();
  const selectedScorers = useWatch({ control, name: 'scorers' });
  const variables = useWatch({ control, name: 'variables' });
  const count = Object.keys(selectedScorers || {}).length;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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

  const handleScorerCreated = useCallback(
    (scorer: { id: string }) => {
      const current = form.getValues('scorers') || {};
      form.setValue('scorers', { ...current, [scorer.id]: { description: '' } }, { shouldDirty: true });
      setIsCreateDialogOpen(false);
    },
    [form],
  );

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Scorers"
            subtitle={`Configure scorers for evaluating agent responses.${count > 0 ? ` (${count} selected)` : ''}`}
            icon={<JudgeIcon className="text-neutral3" />}
          />
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon className="w-3 h-3 mr-1" />
              Create
            </Button>
          )}
        </div>

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

            const handleSamplingChange = (scorerId: string, samplingConfig: ScorerConfig['sampling'] | undefined) => {
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

            const handleRulesChange = (scorerId: string, rules: RuleGroup | undefined) => {
              field.onChange({
                ...currentScorers,
                [scorerId]: { ...currentScorers[scorerId], rules },
              });
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
                        schema={variables}
                        rules={currentScorers[scorer.value]?.rules || undefined}
                        onRulesChange={readOnly ? undefined : rules => handleRulesChange(scorer.value, rules)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      <SideDialog
        dialogTitle="Create Scorer"
        dialogDescription="Create a new scorer for evaluating agent responses"
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      >
        <SideDialog.Content className="p-0 overflow-hidden">
          <ScorerCreateContent onSuccess={handleScorerCreated} />
        </SideDialog.Content>
      </SideDialog>
    </ScrollArea>
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
  schema?: JsonSchema;
  rules?: RuleGroup;
  onRulesChange?: (rules: RuleGroup | undefined) => void;
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
  schema,
  rules,
  onRulesChange,
}: ScorerConfigPanelProps) {
  const samplingType = samplingConfig?.type || 'none';
  const hasVariablesSet = Object.keys(schema?.properties ?? {}).length > 0;
  const showRulesSection = schema && hasVariablesSet && !readOnly;
  const ruleCount = countLeafRules(rules);

  const [isRulesOpen, setIsRulesOpen] = useState(ruleCount > 0);

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
    <div className="rounded-md border border-border1 overflow-hidden">
      <div className="bg-surface2 p-3 flex flex-col gap-2">
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

      {showRulesSection && (
        <Collapsible open={isRulesOpen} onOpenChange={setIsRulesOpen} className="border-t border-border1 bg-surface2">
          <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2">
            <Icon>
              <ChevronRight
                className={cn('text-icon3 transition-transform', {
                  'rotate-90': isRulesOpen,
                })}
              />
            </Icon>
            <Icon>
              <Ruler className="text-accent6" />
            </Icon>
            <span className="text-neutral5 text-ui-sm">Display Conditions</span>
            {ruleCount > 0 && (
              <span className="text-neutral3 text-ui-sm">
                ({ruleCount} {ruleCount === 1 ? 'rule' : 'rules'})
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {onRulesChange && <RuleBuilder schema={schema} ruleGroup={rules} onChange={onRulesChange} />}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
