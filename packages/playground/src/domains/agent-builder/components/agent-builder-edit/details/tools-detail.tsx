import { Checkbox, IconButton, Txt } from '@mastra/playground-ui';
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
  const activeCount = Object.values(enabledMap).filter(Boolean).length;

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
          {availableTools.length > 0 && (
            <Txt variant="ui-xs" className="shrink-0 tabular-nums text-neutral3">
              {activeCount} / {availableTools.length}
            </Txt>
          )}
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="tools-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {availableTools.length === 0 ? (
          <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
            No tools available in this project.
          </Txt>
        ) : (
          <ul className="flex flex-col">
            {availableTools.map(({ id, description }) => {
              const checked = enabledMap[id] ?? false;
              return (
                <li key={id}>
                  <label
                    className="flex cursor-pointer items-start gap-3 px-6 py-4 transition-colors hover:bg-surface2"
                    aria-disabled={!editable}
                  >
                    <div className="mt-0.5">
                      <Checkbox
                        variant="neutral"
                        checked={checked}
                        onCheckedChange={next => toggle(id, next === true)}
                        disabled={!editable}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <Txt variant="ui-sm" className="font-medium text-neutral6">
                        {id}
                      </Txt>
                      {description && (
                        <Txt variant="ui-xs" className="mt-0.5 truncate text-neutral3" title={description}>
                          {description}
                        </Txt>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
