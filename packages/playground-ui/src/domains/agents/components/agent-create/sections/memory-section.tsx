'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { MemoryIcon } from '@/ds/icons';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { MultiSelectPicker } from '../../create-agent/multi-select-picker';
import type { AgentFormValues } from '../../create-agent/form-validation';

interface MemorySectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function MemorySection({ control, error }: MemorySectionProps) {
  const { data: memoryConfigsData, isLoading } = useMemoryConfig();

  // Memory options - currently returns empty as memory config needs different handling
  const options = useMemo(() => {
    return [] as { id: string; name: string; description: string }[];
  }, [memoryConfigsData]);

  return (
    <Section title={<Section.Title icon={<MemoryIcon className="text-accent1" />}>Memory</Section.Title>}>
      <Controller
        name="memory"
        control={control}
        render={({ field }) => (
          <MultiSelectPicker<{ id: string; name: string; description: string }>
            label=""
            options={options}
            selected={field.value ? [field.value] : []}
            onChange={selected => field.onChange(selected[0] || '')}
            getOptionId={option => option.id}
            getOptionLabel={option => option.name}
            getOptionDescription={option => option.description}
            placeholder="Select memory configuration..."
            searchPlaceholder="Search memory configs..."
            emptyMessage="No memory configurations registered"
            disabled={isLoading}
            singleSelect={true}
            error={error}
          />
        )}
      />
    </Section>
  );
}
