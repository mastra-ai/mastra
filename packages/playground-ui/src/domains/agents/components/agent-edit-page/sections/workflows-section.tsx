import { useMemo, useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';

import { EntityAccordionItem } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import type { AgentFormValues, EntityConfig } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';

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
    <div className="rounded-md border border-border1 bg-surface2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full p-3 bg-surface3">
          <ChevronRight className="h-4 w-4 text-neutral3" />
          <SectionTitle icon={<WorkflowIcon className="text-accent3" />}>
            Workflows{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
          </SectionTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 border-t border-border1">
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
                    <MultiCombobox
                      options={options}
                      value={selectedIds}
                      onValueChange={handleValueChange}
                      placeholder="Select workflows..."
                      searchPlaceholder="Search workflows..."
                      emptyText="No workflows available"
                      disabled={isLoading || readOnly}
                      error={error}
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
