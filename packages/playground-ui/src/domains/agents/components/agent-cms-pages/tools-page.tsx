import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { Section } from '@/ds/components/Section';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { IntegrationToolsSection } from '@/domains/tool-providers/components';
import { MCPClientList } from '@/domains/mcps/components/mcp-client-list';
import type { RuleGroup } from '@/lib/rule-engine';
import type { EntityConfig } from '../../components/agent-edit-page/utils/form-validation';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function ToolsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: tools, isLoading: isLoadingTools } = useTools();

  const selectedTools = useWatch({ control, name: 'tools' });
  const selectedIntegrationTools = useWatch({ control, name: 'integrationTools' });
  const variables = useWatch({ control, name: 'variables' });

  const options = useMemo(() => {
    const opts: { value: string; label: string; description: string; start: React.ReactNode }[] = [];

    if (tools) {
      for (const [id, tool] of Object.entries(tools)) {
        opts.push({
          value: id,
          label: (tool as { name?: string }).name || id,
          description: (tool as { description?: string }).description || '',
          start: <ToolsIcon className="text-accent6 h-4 w-4" />,
        });
      }
    }

    return opts;
  }, [tools]);

  const selectedToolIds = Object.keys(selectedTools || {});
  const totalCount = selectedToolIds.length;

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (newIds: string[]) => {
    const newTools: Record<string, EntityConfig> = {};

    for (const id of newIds) {
      newTools[id] = selectedTools?.[id] || { description: getOriginalDescription(id) };
    }

    form.setValue('tools', newTools);
  };

  const handleDescriptionChange = (toolId: string, description: string) => {
    form.setValue('tools', {
      ...selectedTools,
      [toolId]: { ...selectedTools?.[toolId], description },
    });
  };

  const handleRemove = (toolId: string) => {
    const next = { ...selectedTools };
    delete next[toolId];
    form.setValue('tools', next);
  };

  const handleRulesChange = (toolId: string, rules: RuleGroup | undefined) => {
    form.setValue('tools', {
      ...selectedTools,
      [toolId]: { ...selectedTools?.[toolId], rules },
    });
  };

  const handleIntegrationToolsSubmit = useCallback(
    (providerId: string, tools: Map<string, string>) => {
      const next = { ...selectedIntegrationTools };

      // Remove all tools from this provider
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${providerId}:`)) {
          delete next[key];
        }
      }

      // Add selected tools, preserving existing config (rules) if available
      for (const [id, description] of tools) {
        next[id] = selectedIntegrationTools?.[id] || { description };
      }

      form.setValue('integrationTools', next);
    },
    [form, selectedIntegrationTools],
  );

  const selectedOptions = options.filter(opt => selectedToolIds.includes(opt.value));

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Tools"
          subtitle={`Select the tools this agent can use.${totalCount > 0 ? ` (${totalCount} selected)` : ''}`}
          icon={<ToolsIcon className="text-accent6" />}
        />

        <MCPClientList />

        <IntegrationToolsSection
          selectedToolIds={selectedIntegrationTools}
          onSubmitTools={readOnly ? undefined : handleIntegrationToolsSubmit}
        />

        <Section>
          <Section.Header>
            <Section.Heading>
              <ToolsIcon />
              Available Tools
            </Section.Heading>
          </Section.Header>

          <div className="flex flex-col gap-2">
            <MultiCombobox
              options={options}
              value={selectedToolIds}
              onValueChange={handleValueChange}
              placeholder="Select tools..."
              searchPlaceholder="Search tools..."
              emptyText="No tools available"
              disabled={isLoadingTools || readOnly}
              variant="light"
            />
            {selectedOptions.length > 0 && (
              <div className="flex flex-col gap-3 mt-2">
                {selectedOptions.map(tool => (
                  <EntityAccordionItem
                    key={tool.value}
                    id={tool.value}
                    name={tool.label}
                    icon={<ToolsIcon className="text-accent6" />}
                    description={selectedTools?.[tool.value]?.description || ''}
                    onDescriptionChange={readOnly ? undefined : desc => handleDescriptionChange(tool.value, desc)}
                    onRemove={readOnly ? undefined : () => handleRemove(tool.value)}
                    schema={variables}
                    rules={selectedTools?.[tool.value]?.rules || undefined}
                    onRulesChange={readOnly ? undefined : rules => handleRulesChange(tool.value, rules)}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}
