'use client';

import { useMemo, useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';

import { Section, EntityAccordionItem } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import type { AgentFormValues } from '../../agent-edit/form-validation';

interface EntityConfig {
  description?: string;
}

interface WorkflowsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function WorkflowsSection({ control, error }: WorkflowsSectionProps) {
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Section
        title={
          <CollapsibleTrigger className="flex items-center gap-1 w-full">
            <ChevronRight className="h-4 w-4 text-icon3" />
            <Section.Title icon={<WorkflowIcon className="text-accent3" />}>
              Workflows{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
            </Section.Title>
          </CollapsibleTrigger>
        }
      >
        <CollapsibleContent>
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
                    disabled={isLoading}
                    error={error}
                    variant="light"
                  />
                  {selectedOptions.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      {selectedOptions.map(workflow => (
                        <EntityAccordionItem
                          key={workflow.value}
                          id={workflow.value}
                          name={workflow.label}
                          icon={<WorkflowIcon className="text-accent3" />}
                          description={field.value?.[workflow.value]?.description || ''}
                          onDescriptionChange={desc => handleDescriptionChange(workflow.value, desc)}
                          onRemove={() => handleRemove(workflow.value)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </CollapsibleContent>
      </Section>
    </Collapsible>
  );
}
