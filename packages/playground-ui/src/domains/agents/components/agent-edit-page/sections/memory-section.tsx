'use client';

import { useMemo } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { MemoryIcon } from '@/ds/icons';
import { Combobox } from '@/ds/components/Combobox';
import { useMemoryConfig } from '@/domains/memory/hooks';
import type { AgentFormValues } from '../../agent-edit/form-validation';

interface MemorySectionProps {
  control: Control<AgentFormValues>;
  error?: string;
}

export function MemorySection({ control, error }: MemorySectionProps) {
  const { data: memoryConfigsData, isLoading } = useMemoryConfig();
  const selectedMemory = useWatch({ control, name: 'memory' });
  const count = selectedMemory ? 1 : 0;

  // Memory options - currently returns empty as memory config needs different handling
  const options = useMemo(() => {
    return [] as { value: string; label: string; description: string }[];
  }, [memoryConfigsData]);

  return (
    <Section
      title={
        <Section.Title icon={<MemoryIcon className="text-accent1" />}>
          Memory{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
        </Section.Title>
      }
    >
      <Controller
        name="memory"
        control={control}
        render={({ field }) => (
          <Combobox
            options={options}
            value={field.value || ''}
            onValueChange={field.onChange}
            placeholder="Select memory configuration..."
            searchPlaceholder="Search memory configs..."
            emptyText="No memory configurations registered"
            disabled={isLoading}
            error={error}
            variant="light"
          />
        )}
      />
    </Section>
  );
}
