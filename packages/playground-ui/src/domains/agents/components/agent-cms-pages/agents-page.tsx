import { useCallback, useMemo, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { PlusIcon } from 'lucide-react';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { AgentIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { SideDialog } from '@/ds/components/SideDialog';
import { useAgents } from '../../hooks/use-agents';
import type { RuleGroup } from '@/lib/rule-engine';
import type { EntityConfig } from '../../components/agent-edit-page/utils/form-validation';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCreateContent } from '../agent-create-content';

export function AgentsPage() {
  const { form, readOnly, agentId: currentAgentId } = useAgentEditFormContext();
  const { control } = form;
  const { data: agents, isLoading } = useAgents();
  const selectedAgents = useWatch({ control, name: 'agents' });
  const variables = useWatch({ control, name: 'variables' });
  const count = Object.keys(selectedAgents || {}).length;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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

  const handleAgentCreated = useCallback(
    (agent: { id: string }) => {
      const current = form.getValues('agents') || {};
      form.setValue('agents', { ...current, [agent.id]: { description: '' } }, { shouldDirty: true });
      setIsCreateDialogOpen(false);
    },
    [form],
  );

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Sub-Agents"
            subtitle={`Select sub-agents for this agent to delegate to.${count > 0 ? ` (${count} selected)` : ''}`}
            icon={<AgentIcon className="text-accent1" />}
          />
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon className="w-3 h-3 mr-1" />
              Create
            </Button>
          )}
        </div>

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

            const handleRulesChange = (agentIdVal: string, rules: RuleGroup | undefined) => {
              field.onChange({
                ...field.value,
                [agentIdVal]: { ...field.value?.[agentIdVal], rules },
              });
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
                        onDescriptionChange={readOnly ? undefined : desc => handleDescriptionChange(agent.value, desc)}
                        onRemove={readOnly ? undefined : () => handleRemove(agent.value)}
                        schema={variables}
                        rules={field.value?.[agent.value]?.rules || undefined}
                        onRulesChange={readOnly ? undefined : rules => handleRulesChange(agent.value, rules)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      <SideDialog
        dialogTitle="Create Sub-Agent"
        dialogDescription="Create a new agent to use as a sub-agent"
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      >
        <SideDialog.Content className="p-0 overflow-hidden">
          <AgentCreateContent onSuccess={handleAgentCreated} hideSubAgentCreate />
        </SideDialog.Content>
      </SideDialog>
    </ScrollArea>
  );
}
