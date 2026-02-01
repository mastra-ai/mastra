'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section, RemovableBadge } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
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
      value: id,
      label: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description || '',
    }));
  }, [tools]);

  return (
    <Section title={<Section.Title icon={<ToolsIcon className="text-accent6" />}>Tools</Section.Title>}>
      <Controller
        name="tools"
        control={control}
        render={({ field }) => {
          const selectedTools = options.filter(opt => field.value?.includes(opt.value));

          return (
            <div className="flex flex-col gap-2">
              <MultiCombobox
                options={options}
                value={field.value || []}
                onValueChange={field.onChange}
                placeholder="Select tools..."
                searchPlaceholder="Search tools..."
                emptyText="No tools available"
                disabled={isLoading}
                error={error}
                variant="light"
              />
              {selectedTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTools.map(tool => (
                    <RemovableBadge
                      key={tool.value}
                      icon={<ToolsIcon className="text-accent6" />}
                      onRemove={() => {
                        const newValue = field.value?.filter(v => v !== tool.value) || [];
                        field.onChange(newValue);
                      }}
                    >
                      {tool.label}
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
