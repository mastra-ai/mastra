import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { Plug } from 'lucide-react';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Badge } from '@/ds/components/Badge';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useAllIntegrationTools } from '@/domains/tool-providers/hooks';
import type { RuleGroup } from '@/lib/rule-engine';
import type { EntityConfig } from '../../components/agent-edit-page/utils/form-validation';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function ToolsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: tools, isLoading: isLoadingTools } = useTools();
  const { data: integrationTools, isLoading: isLoadingIntegration } = useAllIntegrationTools();

  const selectedTools = useWatch({ control, name: 'tools' });
  const selectedIntegrationTools = useWatch({ control, name: 'integrationTools' });
  const variables = useWatch({ control, name: 'variables' });

  const { options, integrationToolIds } = useMemo(() => {
    const integrationToolIds = new Set<string>();
    const opts: { value: string; label: string; description: string; start: React.ReactNode; end?: React.ReactNode }[] =
      [];

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

    for (const tool of integrationTools) {
      const id = `${tool.providerId}:${tool.slug}`;
      integrationToolIds.add(id);
      opts.push({
        value: id,
        label: tool.name || tool.slug,
        description: tool.description || '',
        start: <Plug className="text-accent5 h-4 w-4" />,
        end: <Badge>{tool.providerName}</Badge>,
      });
    }

    return { options: opts, integrationToolIds };
  }, [tools, integrationTools]);

  const allSelectedIds = [...Object.keys(selectedTools || {}), ...Object.keys(selectedIntegrationTools || {})];
  const totalCount = allSelectedIds.length;

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (newIds: string[]) => {
    const newTools: Record<string, EntityConfig> = {};
    const newIntegration: Record<string, EntityConfig> = {};

    for (const id of newIds) {
      if (integrationToolIds.has(id)) {
        newIntegration[id] = selectedIntegrationTools?.[id] || { description: getOriginalDescription(id) };
      } else {
        newTools[id] = selectedTools?.[id] || { description: getOriginalDescription(id) };
      }
    }

    form.setValue('tools', newTools);
    form.setValue('integrationTools', newIntegration);
  };

  const handleDescriptionChange = (toolId: string, description: string) => {
    if (integrationToolIds.has(toolId)) {
      form.setValue('integrationTools', {
        ...selectedIntegrationTools,
        [toolId]: { ...selectedIntegrationTools?.[toolId], description },
      });
    } else {
      form.setValue('tools', {
        ...selectedTools,
        [toolId]: { ...selectedTools?.[toolId], description },
      });
    }
  };

  const handleRemove = (toolId: string) => {
    if (integrationToolIds.has(toolId)) {
      const next = { ...selectedIntegrationTools };
      delete next[toolId];
      form.setValue('integrationTools', next);
    } else {
      const next = { ...selectedTools };
      delete next[toolId];
      form.setValue('tools', next);
    }
  };

  const handleRulesChange = (toolId: string, rules: RuleGroup | undefined) => {
    if (integrationToolIds.has(toolId)) {
      form.setValue('integrationTools', {
        ...selectedIntegrationTools,
        [toolId]: { ...selectedIntegrationTools?.[toolId], rules },
      });
    } else {
      form.setValue('tools', {
        ...selectedTools,
        [toolId]: { ...selectedTools?.[toolId], rules },
      });
    }
  };

  const selectedOptions = options.filter(opt => allSelectedIds.includes(opt.value));

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Tools"
          subtitle={`Select the tools this agent can use.${totalCount > 0 ? ` (${totalCount} selected)` : ''}`}
          icon={<ToolsIcon className="text-accent6" />}
        />

        <div className="flex flex-col gap-2">
          <MultiCombobox
            options={options}
            value={allSelectedIds}
            onValueChange={handleValueChange}
            placeholder="Select tools..."
            searchPlaceholder="Search tools..."
            emptyText="No tools available"
            disabled={(isLoadingTools && isLoadingIntegration) || readOnly}
            variant="light"
          />
          {selectedOptions.length > 0 && (
            <div className="flex flex-col gap-3 mt-2">
              {selectedOptions.map(tool => (
                <EntityAccordionItem
                  key={tool.value}
                  id={tool.value}
                  name={tool.label}
                  icon={
                    integrationToolIds.has(tool.value) ? (
                      <Plug className="text-accent5" />
                    ) : (
                      <ToolsIcon className="text-accent6" />
                    )
                  }
                  description={
                    (integrationToolIds.has(tool.value)
                      ? selectedIntegrationTools?.[tool.value]?.description
                      : selectedTools?.[tool.value]?.description) || ''
                  }
                  onDescriptionChange={readOnly ? undefined : desc => handleDescriptionChange(tool.value, desc)}
                  onRemove={readOnly ? undefined : () => handleRemove(tool.value)}
                  schema={variables}
                  rules={
                    (integrationToolIds.has(tool.value)
                      ? selectedIntegrationTools?.[tool.value]?.rules
                      : selectedTools?.[tool.value]?.rules) || undefined
                  }
                  onRulesChange={readOnly ? undefined : rules => handleRulesChange(tool.value, rules)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
