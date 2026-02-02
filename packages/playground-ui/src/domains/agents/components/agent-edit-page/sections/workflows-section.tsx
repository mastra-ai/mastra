'use client';

import { useMemo } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';

import { Section, RemovableBadge } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import type { AgentFormValues } from '../../agent-edit/form-validation';

interface WorkflowsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function WorkflowsSection({ control, error }: WorkflowsSectionProps) {
  const { data: workflows, isLoading } = useWorkflows();
  const selectedWorkflows = useWatch({ control, name: 'workflows' });
  const count = selectedWorkflows?.length || 0;

  const options = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      value: id,
      label: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  return (
    <Section
      title={
        <Section.Title icon={<WorkflowIcon className="text-accent3" />}>
          Workflows{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
        </Section.Title>
      }
    >
      <Controller
        name="workflows"
        control={control}
        render={({ field }) => {
          const selectedWorkflows = options.filter(opt => field.value?.includes(opt.value));

          return (
            <div className="flex flex-col gap-2">
              <MultiCombobox
                options={options}
                value={field.value || []}
                onValueChange={field.onChange}
                placeholder="Select workflows..."
                searchPlaceholder="Search workflows..."
                emptyText="No workflows available"
                disabled={isLoading}
                error={error}
                variant="light"
              />
              {selectedWorkflows.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedWorkflows.map(workflow => (
                    <RemovableBadge
                      key={workflow.value}
                      icon={<WorkflowIcon className="text-accent3" />}
                      onRemove={() => {
                        const newValue = field.value?.filter(v => v !== workflow.value) || [];
                        field.onChange(newValue);
                      }}
                    >
                      {workflow.label}
                    </RemovableBadge>
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
