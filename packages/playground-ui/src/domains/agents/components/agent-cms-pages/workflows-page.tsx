import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { SectionHeader } from '@/domains/cms';
import { WorkflowIcon, Icon } from '@/ds/icons';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Section } from '@/ds/components/Section';
import { SubSectionRoot } from '@/ds/components/Section/section-root';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { EntityName, EntityDescription, EntityContent, Entity } from '@/ds/components/Entity';
import { stringToColor } from '@/lib/colors';
import { Switch } from '@/ds/components/Switch';
import { cn } from '@/lib/utils';
import { Searchbar } from '@/ds/components/Searchbar';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function WorkflowsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: workflows } = useWorkflows();
  const selectedWorkflows = useWatch({ control, name: 'workflows' });
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
      form.setValue('workflows', next);
    } else {
      form.setValue('workflows', {
        ...selectedWorkflows,
        [workflowId]: { ...selectedWorkflows?.[workflowId], description: getOriginalDescription(workflowId) },
      });
    }
  };

  const handleDescriptionChange = (workflowId: string, description: string) => {
    form.setValue('workflows', {
      ...selectedWorkflows,
      [workflowId]: { ...selectedWorkflows?.[workflowId], description },
    });
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
          icon={<WorkflowIcon />}
        />

        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Available Workflows" icon={<WorkflowIcon />} />
          </Section.Header>

          <Searchbar onSearch={setSearch} label="Search workflows" placeholder="Search workflows" />

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(workflow => {
                const bg = stringToColor(workflow.value);
                const text = stringToColor(workflow.value, 25);
                const isSelected = selectedWorkflowIds.includes(workflow.value);

                const isDisabled = readOnly || !isSelected;

                return (
                  <Entity key={workflow.value} className="bg-surface2">
                    <div
                      className="size-11 rounded-lg flex items-center justify-center uppercase shrink-0"
                      style={{ backgroundColor: bg, color: text }}
                    >
                      <Icon size="lg">
                        <WorkflowIcon />
                      </Icon>
                    </div>

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
