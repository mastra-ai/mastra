import { useMemo, useState } from 'react';
import { Controller, Control, useWatch } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';

import { EntityAccordionItem } from '@/domains/cms';
import { ToolsIcon } from '@/ds/icons';
import { MultiCombobox } from '@/ds/components/Combobox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import type { AgentFormValues, EntityConfig } from '../utils/form-validation';
import { SectionTitle } from '@/domains/cms/components/section/section-title';

interface ToolsSectionProps {
  control: Control<AgentFormValues>;
  error?: string;
  readOnly?: boolean;
}

export function ToolsSection({ control, error, readOnly = false }: ToolsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="rounded-md border border-border1 bg-surface2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full p-3 bg-surface3">
          <ChevronRight className="h-4 w-4 text-neutral3" />
          <SectionTitle icon={<ToolsIcon className="text-accent6" />}>
            Tools{count > 0 && <span className="text-neutral3 font-normal">({count})</span>}
          </SectionTitle>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 border-t border-border1">
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
                      error={error}
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
                            onDescriptionChange={
                              readOnly ? undefined : desc => handleDescriptionChange(tool.value, desc)
                            }
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
