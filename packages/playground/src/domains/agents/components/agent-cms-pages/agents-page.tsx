import {
  EntityName,
  EntityDescription,
  EntityContent,
  Entity,
  ScrollArea,
  Searchbar,
  Section,
  SubSectionRoot,
  Switch,
  AgentIcon,
  cn,
} from '@mastra/playground-ui';
import type { RuleGroup } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useAgents } from '../../hooks/use-agents';
import { SectionHeader, DisplayConditionsDialog } from '@/domains/cms';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';

export function AgentsPage() {
  const { form, readOnly, agentId: currentAgentId } = useAgentEditFormContext();
  const { control } = form;
  const { data: agents } = useAgents();
  const selectedAgents = useWatch({ control, name: 'agents' });
  const variables = useWatch({ control, name: 'variables' });
  const [search, setSearch] = useState('');

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
      form.setValue('agents', next, { shouldDirty: true });
    } else {
      form.setValue(
        'agents',
        {
          ...selectedAgents,
          [agentId]: { ...selectedAgents?.[agentId], description: getOriginalDescription(agentId) },
        },
        { shouldDirty: true },
      );
    }
  };

  const handleDescriptionChange = (agentId: string, description: string) => {
    form.setValue(
      'agents',
      {
        ...selectedAgents,
        [agentId]: { ...selectedAgents?.[agentId], description },
      },
      { shouldDirty: true },
    );
  };

  const handleRulesChange = (agentId: string, rules: RuleGroup | undefined) => {
    form.setValue(
      'agents',
      {
        ...selectedAgents,
        [agentId]: { ...selectedAgents?.[agentId], rules },
      },
      { shouldDirty: true },
    );
  };

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
          />
        </div>

        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Available Agents" icon={<AgentIcon />} />
          </Section.Header>

          <Searchbar onSearch={setSearch} label="Search agents" placeholder="Search agents" />

          {filteredOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(agent => {
                const isSelected = selectedAgentIds.includes(agent.value);

                const isDisabled = readOnly || !isSelected;

                return (
                  <Entity key={agent.value} className="bg-surface2">
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

                    {isSelected && !readOnly && (
                      <DisplayConditionsDialog
                        entityName={agent.label}
                        schema={variables}
                        rules={selectedAgents?.[agent.value]?.rules}
                        onRulesChange={rules => handleRulesChange(agent.value, rules)}
                      />
                    )}

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
    </ScrollArea>
  );
}
