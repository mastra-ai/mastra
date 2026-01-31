'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { JudgeIcon } from '@/ds/icons';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { ScorersPicker } from '../../create-agent/scorers-picker';
import type { AgentFormValues } from '../../create-agent/form-validation';

interface ScorersSectionProps {
  control: Control<AgentFormValues>;
}

export function ScorersSection({ control }: ScorersSectionProps) {
  const { data: scorers, isLoading } = useScorers();

  const options = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      id,
      name: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  return (
    <Section title={<Section.Title icon={<JudgeIcon className="text-neutral3" />}>Scorers</Section.Title>}>
      <Controller
        name="scorers"
        control={control}
        render={({ field }) => (
          <ScorersPicker
            selected={field.value || {}}
            onChange={field.onChange}
            options={options}
            disabled={isLoading}
          />
        )}
      />
    </Section>
  );
}
