import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import type { RuleGroup } from '@/lib/rule-engine';
import type { EntityConfig } from '../../components/agent-edit-page/utils/form-validation';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function WorkflowsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: workflows, isLoading } = useWorkflows();
  const selectedWorkflows = useWatch({ control, name: 'workflows' });
  const variables = useWatch({ control, name: 'variables' });
  const count = Object.keys(selectedWorkflows || {}).length;

  const options = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      value: id,
      label: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Workflows"
          subtitle={`Select workflows this agent can trigger.${count > 0 ? ` (${count} selected)` : ''}`}
          icon={<WorkflowIcon className="text-accent3" />}
        />

        <Controller
          name="workflows"
          control={control}
          render={({ field }) => {
            const selectedIds = Object.keys(field.value || {});
            const selectedOptions = options.filter(opt => selectedIds.includes(opt.value));

            const handleValueChange = (newIds: string[]) => {
              const newValue: Record<string, EntityConfig> = {};
              for (const id of newIds) {
                newValue[id] = field.value?.[id] || {
                  description: getOriginalDescription(id),
                };
              }
              field.onChange(newValue);
            };

            const handleDescriptionChange = (workflowId: string, description: string) => {
              field.onChange({
                ...field.value,
                [workflowId]: { ...field.value?.[workflowId], description },
              });
            };

            const handleRemove = (workflowId: string) => {
              const newValue = { ...field.value };
              delete newValue[workflowId];
              field.onChange(newValue);
            };

            const handleRulesChange = (workflowId: string, rules: RuleGroup | undefined) => {
              field.onChange({
                ...field.value,
                [workflowId]: { ...field.value?.[workflowId], rules },
              });
            };

            return (
              <div className="flex flex-col gap-2">
                <MultiCombobox
                  options={options}
                  value={selectedIds}
                  onValueChange={handleValueChange}
                  placeholder="Select workflows..."
                  searchPlaceholder="Search workflows..."
                  emptyText="No workflows available"
                  disabled={isLoading || readOnly}
                  variant="light"
                />
                {selectedOptions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2">
                    {selectedOptions.map(workflow => (
                      <EntityAccordionItem
                        key={workflow.value}
                        id={workflow.value}
                        name={workflow.label}
                        icon={<WorkflowIcon className="text-accent3" />}
                        description={field.value?.[workflow.value]?.description || ''}
                        onDescriptionChange={
                          readOnly ? undefined : desc => handleDescriptionChange(workflow.value, desc)
                        }
                        onRemove={readOnly ? undefined : () => handleRemove(workflow.value)}
                        schema={variables}
                        rules={field.value?.[workflow.value]?.rules || undefined}
                        onRulesChange={readOnly ? undefined : rules => handleRulesChange(workflow.value, rules)}
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
