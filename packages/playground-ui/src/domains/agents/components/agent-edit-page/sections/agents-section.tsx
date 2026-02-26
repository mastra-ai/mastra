import { useMemo, useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';

import { EntityAccordionItem } from '@/domains/cms';
import { AgentIcon, Icon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { useAgents } from '../../../hooks/use-agents';
import type { AgentFormValues, EntityConfig } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';

interface AgentsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
  currentAgentId?: string;
  readOnly?: boolean;
}

export function AgentsSection({ control, error, currentAgentId, readOnly = false }: AgentsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    // Filter out current agent from sub-agents picker
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
    <div className="rounded-md border border-border1 bg-surface2">
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

          const handleDescriptionChange = (agentId: string, description: string) => {
            field.onChange({
              ...field.value,
              [agentId]: { ...field.value?.[agentId], description },
            });
          };

          const handleRemove = (agentId: string) => {
            const newValue = { ...field.value };
            delete newValue[agentId];
            field.onChange(newValue);
          };

          return (
            <>
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-between p-3 bg-surface3">
                  <CollapsibleTrigger className="flex items-center gap-1 w-full">
                    <ChevronRight className="h-4 w-4 text-neutral3" />
                    <SectionTitle icon={<AgentIcon className="text-accent1" />}>
                      Sub-Agents{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
                    </SectionTitle>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="p-3 border-t border-border1">
                    <div className="flex flex-col gap-2">
                      <MultiCombobox
                        options={options}
                        value={selectedIds}
                        onValueChange={handleValueChange}
                        placeholder="Select sub-agents..."
                        searchPlaceholder="Search agents..."
                        emptyText="No agents available"
                        disabled={isLoading || readOnly}
                        error={error}
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
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          );
        }}
      />
    </div>
  );
}
