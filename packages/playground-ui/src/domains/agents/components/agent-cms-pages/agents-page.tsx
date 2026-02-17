import { useCallback, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { PlusIcon } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';
import { AgentIcon, Icon } from '@/ds/icons';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { SideDialog } from '@/ds/components/SideDialog';
import { Section } from '@/ds/components/Section';
import { SubSectionRoot } from '@/ds/components/Section/section-root';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { EntityName, EntityDescription, EntityContent, Entity } from '@/ds/components/Entity';
import { stringToColor } from '@/lib/colors';
import { Switch } from '@/ds/components/Switch';
import { cn } from '@/lib/utils';
import { Searchbar } from '@/ds/components/Searchbar';
import { useAgents } from '../../hooks/use-agents';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCreateContent } from '../agent-create-content';

export function AgentsPage() {
  const { form, readOnly, agentId: currentAgentId } = useAgentEditFormContext();
  const { control } = form;
  const { data: agents } = useAgents();
  const selectedAgents = useWatch({ control, name: 'agents' });
  const [search, setSearch] = useState('');
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

  const selectedAgentIds = Object.keys(selectedAgents || {});
  const count = selectedAgentIds.length;

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (agentId: string) => {
    const isSet = selectedAgents?.[agentId] !== undefined;
    if (isSet) {
      const next = { ...selectedAgents };
      delete next[agentId];
      form.setValue('agents', next);
    } else {
      form.setValue('agents', {
        ...selectedAgents,
        [agentId]: { ...selectedAgents?.[agentId], description: getOriginalDescription(agentId) },
      });
    }
  };

  const handleDescriptionChange = (agentId: string, description: string) => {
    form.setValue('agents', {
      ...selectedAgents,
      [agentId]: { ...selectedAgents?.[agentId], description },
    });
  };

  const handleAgentCreated = useCallback(
    (agent: { id: string }) => {
      const current = form.getValues('agents') || {};
      form.setValue('agents', { ...current, [agent.id]: { description: '' } }, { shouldDirty: true });
      setIsCreateDialogOpen(false);
    },
    [form],
  );

  const filteredOptions = useMemo(() => {
    return options.filter(option => option.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
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

        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Available Agents" icon={<AgentIcon />} />
          </Section.Header>

          <Searchbar onSearch={setSearch} label="Search agents" placeholder="Search agents" />

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(agent => {
                const bg = stringToColor(agent.value);
                const text = stringToColor(agent.value, 25);
                const isSelected = selectedAgentIds.includes(agent.value);

                const isDisabled = readOnly || !isSelected;

                return (
                  <Entity key={agent.value} className="bg-surface2">
                    <div
                      className="aspect-square h-full rounded-lg flex items-center justify-center uppercase shrink-0"
                      style={{ backgroundColor: bg, color: text }}
                    >
                      <Icon size="lg">
                        <AgentIcon />
                      </Icon>
                    </div>

                    <EntityContent>
                      <EntityName>{agent.label}</EntityName>
                      <EntityDescription>
                        <input
                          type="text"
                          disabled={isDisabled}
                          className={cn(
                            'border border-transparent appearance-none block w-full text-neutral3 bg-transparent',
                            !isDisabled && 'border-border1 border-dashed ',
                          )}
                          value={
                            isSelected
                              ? (selectedAgents?.[agent.value]?.description ?? agent.description)
                              : agent.description
                          }
                          onChange={e => handleDescriptionChange(agent.value, e.target.value)}
                        />
                      </EntityDescription>
                    </EntityContent>

                    {!readOnly && (
                      <Switch
                        checked={selectedAgentIds.includes(agent.value)}
                        onCheckedChange={() => handleValueChange(agent.value)}
                      />
                    )}
                  </Entity>
                );
              })}
            </div>
          )}
        </SubSectionRoot>
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
