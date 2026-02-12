import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { AgentIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useAgents } from '../../hooks/use-agents';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

interface EntityConfig {
  description?: string;
}

export function AgentsPage() {
  const { form, readOnly, agentId: currentAgentId } = useAgentEditFormContext();
  const { control } = form;
  const { data: agents, isLoading } = useAgents();
  const selectedAgents = useWatch({ control, name: 'agents' });
  const count = Object.keys(selectedAgents || {}).length;

  const options = useMemo(() => {
    if (!agents) return [];
    const agentList = Array.isArray(agents)
      ? agents
      : Object.entries(agents).map(([id, agent]) => ({
          id,
          name: (agent as { name?: string }).name || id,
          description: (agent as { description?: string }).description || '',
        }));
    return agentList
      .filter(agent => agent.id !== currentAgentId)
      .map(agent => ({
        value: agent.id,
        label: agent.name || agent.id,
        description: (agent as { description?: string }).description || '',
      }));
  }, [agents, currentAgentId]);

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Sub-Agents"
          subtitle={`Select sub-agents for this agent to delegate to.${count > 0 ? ` (${count} selected)` : ''}`}
          icon={<AgentIcon className="text-accent1" />}
        />

        <Controller
          name="agents"
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

            const handleDescriptionChange = (agentIdVal: string, description: string) => {
              field.onChange({
                ...field.value,
                [agentIdVal]: { ...field.value?.[agentIdVal], description },
              });
            };

            const handleRemove = (agentIdVal: string) => {
              const newValue = { ...field.value };
              delete newValue[agentIdVal];
              field.onChange(newValue);
            };

            return (
              <div className="flex flex-col gap-2">
                <MultiCombobox
                  options={options}
                  value={selectedIds}
                  onValueChange={handleValueChange}
                  placeholder="Select sub-agents..."
                  searchPlaceholder="Search agents..."
                  emptyText="No agents available"
                  disabled={isLoading || readOnly}
                  variant="light"
                />
                {selectedOptions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2">
                    {selectedOptions.map(agent => (
                      <EntityAccordionItem
                        key={agent.value}
                        id={agent.value}
                        name={agent.label}
                        icon={<AgentIcon className="text-accent1" />}
                        description={field.value?.[agent.value]?.description || ''}
                        onDescriptionChange={
                          readOnly ? undefined : desc => handleDescriptionChange(agent.value, desc)
                        }
                        onRemove={readOnly ? undefined : () => handleRemove(agent.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </ScrollArea>
  );
}
