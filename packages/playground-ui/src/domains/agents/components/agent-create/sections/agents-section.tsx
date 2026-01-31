'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { AgentIcon } from '@/ds/icons';
import { useAgents } from '../../../hooks/use-agents';
import { MultiSelectPicker } from '../../create-agent/multi-select-picker';
import type { AgentFormValues } from '../../create-agent/form-validation';

interface AgentsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
  currentAgentId?: string;
}

export function AgentsSection({ control, error, currentAgentId }: AgentsSectionProps) {
  const { data: agents, isLoading } = useAgents();

  const options = useMemo(() => {
    if (!agents) return [];
    const agentList = Array.isArray(agents)
      ? agents
      : Object.entries(agents).map(([id, agent]) => ({
          id,
          name: (agent as { name?: string }).name || id,
        }));
    // Filter out current agent from sub-agents picker
    return agentList
      .filter(agent => agent.id !== currentAgentId)
      .map(agent => ({
        id: agent.id,
        name: agent.name || agent.id,
        description: '',
      }));
  }, [agents, currentAgentId]);

  return (
    <Section title={<Section.Title icon={<AgentIcon className="text-accent1" />}>Sub-Agents</Section.Title>}>
      <Controller
        name="agents"
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
            placeholder="Select sub-agents..."
            searchPlaceholder="Search agents..."
            emptyMessage="No agents available"
            disabled={isLoading}
            error={error}
          />
        )}
      />
    </Section>
  );
}
