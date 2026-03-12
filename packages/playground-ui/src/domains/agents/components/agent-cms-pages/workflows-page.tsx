import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { SectionHeader, DisplayConditionsDialog } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Section } from '@/ds/components/Section';
import { SubSectionRoot } from '@/ds/components/Section/section-root';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { EntityName, EntityDescription, EntityContent, Entity } from '@/ds/components/Entity';
import { Switch } from '@/ds/components/Switch';
import { cn } from '@/lib/utils';
import { Searchbar } from '@/ds/components/Searchbar';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import type { RuleGroup } from '@/lib/rule-engine';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function WorkflowsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: workflows } = useWorkflows();
  const selectedWorkflows = useWatch({ control, name: 'workflows' });
  const variables = useWatch({ control, name: 'variables' });
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      value: id,
      label: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  const selectedWorkflowIds = Object.keys(selectedWorkflows || {});
  const count = selectedWorkflowIds.length;

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (workflowId: string) => {
    const isSet = selectedWorkflows?.[workflowId] !== undefined;
    if (isSet) {
      const next = { ...selectedWorkflows };
      delete next[workflowId];
      form.setValue('workflows', next, { shouldDirty: true });
    } else {
      form.setValue(
        'workflows',
        {
          ...selectedWorkflows,
          [workflowId]: { ...selectedWorkflows?.[workflowId], description: getOriginalDescription(workflowId) },
        },
        { shouldDirty: true },
      );
    }
  };

  const handleDescriptionChange = (workflowId: string, description: string) => {
    form.setValue(
      'workflows',
      {
        ...selectedWorkflows,
        [workflowId]: { ...selectedWorkflows?.[workflowId], description },
      },
      { shouldDirty: true },
    );
  };

  const handleRulesChange = (workflowId: string, rules: RuleGroup | undefined) => {
    form.setValue(
      'workflows',
      {
        ...selectedWorkflows,
        [workflowId]: { ...selectedWorkflows?.[workflowId], rules },
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
        <SectionHeader
          title="Workflows"
          subtitle={`Select workflows this agent can trigger.${count > 0 ? ` (${count} selected)` : ''}`}
        />

        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Available Workflows" icon={<WorkflowIcon />} />
          </Section.Header>

          <Searchbar onSearch={setSearch} label="Search workflows" placeholder="Search workflows" />

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(workflow => {
                const isSelected = selectedWorkflowIds.includes(workflow.value);

                const isDisabled = readOnly || !isSelected;

                return (
                  <Entity key={workflow.value} className="bg-surface2">
                    <EntityContent>
                      <EntityName>{workflow.label}</EntityName>
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
                              ? (selectedWorkflows?.[workflow.value]?.description ?? workflow.description)
                              : workflow.description
                          }
                          onChange={e => handleDescriptionChange(workflow.value, e.target.value)}
                        />
                      </EntityDescription>
                    </EntityContent>

                    {isSelected && !readOnly && (
                      <DisplayConditionsDialog
                        entityName={workflow.label}
                        schema={variables}
                        rules={selectedWorkflows?.[workflow.value]?.rules}
                        onRulesChange={rules => handleRulesChange(workflow.value, rules)}
                      />
                    )}

                    {!readOnly && (
                      <Switch
                        checked={selectedWorkflowIds.includes(workflow.value)}
                        onCheckedChange={() => handleValueChange(workflow.value)}
                      />
                    )}
                  </Entity>
                );
              })}
            </div>
          )}
        </SubSectionRoot>
      </div>
    </ScrollArea>
  );
}
