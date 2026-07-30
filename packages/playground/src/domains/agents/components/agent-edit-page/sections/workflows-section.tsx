import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Control } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import type { AgentFormValues, EntityConfig } from '../utils/form-validation';
import { EntityAccordionItem } from '@/domains/cms';
import { SectionTitle } from '@/domains/cms/components/section/section-title';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

interface WorkflowsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
  readOnly?: boolean;
}

export function WorkflowsSection({ control, error, readOnly = false }: WorkflowsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: workflows, isLoading } = useWorkflows();
  const selectedWorkflows = useWatch({ control, name: 'workflows' });
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
    <div className="border-border1 bg-surface2 rounded-md border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="bg-surface3 flex w-full items-center gap-1 p-3">
          <ChevronRight className="text-neutral3 h-4 w-4" />
          <SectionTitle icon={<WorkflowIcon className="text-accent3" />}>
            Workflows{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
          </SectionTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-border1 border-t p-3">
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

                return (
                  <div className="flex flex-col gap-2">
                    <Combobox
                      multiple
                      options={options}
                      value={selectedIds}
                      onValueChange={handleValueChange}
                      placeholder="Select workflows..."
                      searchPlaceholder="Search workflows..."
                      emptyText="No workflows available"
                      disabled={isLoading || readOnly}
                      error={error}
                    />
                    {selectedOptions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-3">
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
