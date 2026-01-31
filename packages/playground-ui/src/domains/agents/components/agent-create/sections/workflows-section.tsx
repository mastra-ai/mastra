'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { WorkflowIcon } from '@/ds/icons';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { MultiSelectPicker } from '../../create-agent/multi-select-picker';
import type { AgentFormValues } from '../../create-agent/form-validation';

interface WorkflowsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function WorkflowsSection({ control, error }: WorkflowsSectionProps) {
  const { data: workflows, isLoading } = useWorkflows();

  const options = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      id,
      name: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  return (
    <Section title={<Section.Title icon={<WorkflowIcon className="text-accent3" />}>Workflows</Section.Title>}>
      <Controller
        name="workflows"
        control={control}
        render={({ field }) => (
          <MultiSelectPicker
            label=""
            options={options}
            selected={field.value || []}
            onChange={field.onChange}
            getOptionId={option => option.id}
            getOptionLabel={option => option.name}
            getOptionDescription={option => option.description}
            placeholder="Select workflows..."
            searchPlaceholder="Search workflows..."
            emptyMessage="No workflows available"
            disabled={isLoading}
            error={error}
          />
        )}
      />
    </Section>
  );
}
