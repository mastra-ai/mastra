import {
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  ScrollArea,
  Searchbar,
  Switch,
} from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { SectionHeader } from '@/domains/cms';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

export function ToolsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: tools } = useTools();
  const selectedTools = useWatch({ control, name: 'tools' });
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    const opts: { value: string; label: string; description: string }[] = [];

    if (tools) {
      for (const [id, tool] of Object.entries(tools)) {
        opts.push({
          value: id,
          label: id,
          description: tool.description || '',
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

  const handleToggleTool = (toolId: string) => {
    const currentTools = form.getValues('tools') ?? {};
    const isSelected = currentTools[toolId] !== undefined;
    if (isSelected) {
      const next = { ...currentTools };
      delete next[toolId];
      form.setValue('tools', next, { shouldDirty: true });
    } else {
      form.setValue(
        'tools',
        {
          ...currentTools,
          [toolId]: { ...currentTools[toolId], description: getOriginalDescription(toolId) },
        },
        { shouldDirty: true },
      );
    }
  };

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <SectionHeader
          title="Tools"
          subtitle={`Give your agent actions it can take by selecting tools.${totalCount > 0 ? ` (${totalCount} selected)` : ''}`}
        />

        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools" />

        {filteredOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredOptions.map(tool => (
              <Entity key={tool.value} className="bg-surface2">
                <EntityContent>
                  <EntityName>{tool.label}</EntityName>
                  <EntityDescription>{tool.description || 'No description'}</EntityDescription>
                </EntityContent>

                {!readOnly && (
                  <Switch
                    checked={selectedToolIds.includes(tool.value)}
                    onCheckedChange={() => handleToggleTool(tool.value)}
                  />
                )}
              </Entity>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
