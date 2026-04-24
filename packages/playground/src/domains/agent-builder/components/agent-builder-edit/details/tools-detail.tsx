import { IconButton, Switch, Txt } from '@mastra/playground-ui';
import { WrenchIcon, XIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AvailableTool } from '../agent-configure-panel';

interface ToolsDetailProps {
  onClose: () => void;
  editable?: boolean;
  availableTools?: AvailableTool[];
}

export const ToolsDetail = ({ onClose, editable = true, availableTools = [] }: ToolsDetailProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const enabledMap = useWatch({ control, name: 'tools' }) ?? {};

  const toggle = (id: string, next: boolean) => {
    setValue('tools', { ...enabledMap, [id]: next }, { shouldDirty: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <WrenchIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Tools
          </Txt>
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="tools-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {availableTools.length === 0 ? (
          <Txt variant="ui-sm" className="text-neutral3">
            No tools available in this project.
          </Txt>
        ) : (
          <div className="flex flex-col gap-2">
            {availableTools.map(({ id, description }) => (
              <div
                key={id}
                className="flex items-start justify-between gap-4 rounded-md border border-border1 bg-surface2 p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <Txt variant="ui-sm" className="font-medium text-neutral6">
                    {id}
                  </Txt>
                  {description && (
                    <Txt variant="ui-sm" className="text-neutral3">
                      {description}
                    </Txt>
                  )}
                </div>
                <Switch
                  checked={enabledMap[id] ?? false}
                  onCheckedChange={next => toggle(id, next)}
                  disabled={!editable}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
