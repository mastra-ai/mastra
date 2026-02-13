import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';

import { EntityAccordionItem, SectionHeader } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

interface EntityConfig {
  description?: string;
}

export function ToolsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: tools, isLoading } = useTools();
  const selectedTools = useWatch({ control, name: 'tools' });
  const count = Object.keys(selectedTools || {}).length;

  const options = useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      value: id,
      label: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description || '',
    }));
  }, [tools]);

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Tools"
          subtitle={`Select the tools this agent can use.${count > 0 ? ` (${count} selected)` : ''}`}
          icon={<ToolsIcon className="text-accent6" />}
        />

        <Controller
          name="tools"
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

            const handleDescriptionChange = (toolId: string, description: string) => {
              field.onChange({
                ...field.value,
                [toolId]: { ...field.value?.[toolId], description },
              });
            };

            const handleRemove = (toolId: string) => {
              const newValue = { ...field.value };
              delete newValue[toolId];
              field.onChange(newValue);
            };

            return (
              <div className="flex flex-col gap-2">
                <MultiCombobox
                  options={options}
                  value={selectedIds}
                  onValueChange={handleValueChange}
                  placeholder="Select tools..."
                  searchPlaceholder="Search tools..."
                  emptyText="No tools available"
                  disabled={isLoading || readOnly}
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
                        description={field.value?.[tool.value]?.description || ''}
                        onDescriptionChange={readOnly ? undefined : desc => handleDescriptionChange(tool.value, desc)}
                        onRemove={readOnly ? undefined : () => handleRemove(tool.value)}
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
