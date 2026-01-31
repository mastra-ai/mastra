'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { MultiSelectPicker } from '../../create-agent/multi-select-picker';
import type { AgentFormValues } from '../../create-agent/form-validation';

interface ToolsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function ToolsSection({ control, error }: ToolsSectionProps) {
  const { data: tools, isLoading } = useTools();

  const options = useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      id,
      name: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description || '',
    }));
  }, [tools]);

  return (
    <Section title={<Section.Title icon={<ToolsIcon className="text-accent6" />}>Tools</Section.Title>}>
      <Controller
        name="tools"
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
            placeholder="Select tools..."
            searchPlaceholder="Search tools..."
            emptyMessage="No tools available"
            disabled={isLoading}
            error={error}
          />
        )}
      />
    </Section>
  );
}
