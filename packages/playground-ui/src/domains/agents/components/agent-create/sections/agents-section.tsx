'use client';

import { useMemo } from 'react';
import { Controller, Control } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { AgentIcon } from '@/ds/icons';
import { Badge } from '@/ds/components/Badge';
import { MultiCombobox } from '@/ds/components/Combobox';
import { useAgents } from '../../../hooks/use-agents';
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
        value: agent.id,
        label: agent.name || agent.id,
        description: '',
      }));
  }, [agents, currentAgentId]);

  return (
    <Section title={<Section.Title icon={<AgentIcon className="text-accent1" />}>Sub-Agents</Section.Title>}>
      <Controller
        name="agents"
        control={control}
        render={({ field }) => {
          const selectedAgents = options.filter(opt => field.value?.includes(opt.value));

          return (
            <div className="flex flex-col gap-2">
              <MultiCombobox
                options={options}
                value={field.value || []}
                onValueChange={field.onChange}
                placeholder="Select sub-agents..."
                searchPlaceholder="Search agents..."
                emptyText="No agents available"
                disabled={isLoading}
                error={error}
                variant="light"
              />
              {selectedAgents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgents.map(agent => (
                    <Badge key={agent.value} icon={<AgentIcon className="text-accent1" />} variant="success">
                      {agent.label}
                    </Badge>
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
