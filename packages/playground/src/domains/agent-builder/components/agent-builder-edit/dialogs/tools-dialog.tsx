import { SideDialog, Switch, Txt } from '@mastra/playground-ui';
import { WrenchIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AvailableTool } from '../agent-configure-panel';

interface ToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editable?: boolean;
  availableTools?: AvailableTool[];
}

export const ToolsDialog = ({
  open,
  onOpenChange,
  editable = true,
  availableTools = [],
}: ToolsDialogProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const enabledMap = useWatch({ control, name: 'tools' }) ?? {};

  const toggle = (id: string, next: boolean) => {
    setValue('tools', { ...enabledMap, [id]: next }, { shouldDirty: true });
  };

  return (
    <SideDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      dialogTitle="Tools"
      dialogDescription="Select the tools your agent is allowed to use."
      level={2}
    >
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <WrenchIcon /> Tools
          </SideDialog.Heading>
        </SideDialog.Header>

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
      </SideDialog.Content>
    </SideDialog>
  );
};
