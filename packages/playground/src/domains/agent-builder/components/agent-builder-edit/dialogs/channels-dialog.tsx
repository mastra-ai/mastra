import { SideDialog, Switch, Txt } from '@mastra/playground-ui';
import { RadioIcon } from 'lucide-react';
import { useState } from 'react';
import { channelsFixture } from '../../../fixtures';

interface ChannelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editable?: boolean;
}

export const ChannelsDialog = ({ open, onOpenChange, editable = true }: ChannelsDialogProps) => {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(channelsFixture.map(c => [c.id, c.enabled])),
  );

  const toggle = (id: string, next: boolean) => setEnabledMap(prev => ({ ...prev, [id]: next }));

  return (
    <SideDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      dialogTitle="Channels"
      dialogDescription="Choose where this agent can be reached."
      level={2}
    >
      <SideDialog.Top>
        <RadioIcon className="size-4" /> Channels
      </SideDialog.Top>
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <RadioIcon /> Channels
          </SideDialog.Heading>
        </SideDialog.Header>

        <Txt variant="ui-sm" className="text-neutral3">
          Choose where this agent can be reached.
        </Txt>

        <div className="flex flex-col gap-2">
          {channelsFixture.map(channel => (
            <div
              key={channel.id}
              className="flex items-start justify-between gap-4 rounded-md border border-border1 bg-surface2 p-4"
            >
              <div className="flex flex-col gap-1">
                <Txt variant="ui-sm" className="font-medium text-neutral6">
                  {channel.name}
                </Txt>
                <Txt variant="ui-sm" className="text-neutral3">
                  {channel.description}
                </Txt>
              </div>
              <Switch
                checked={enabledMap[channel.id] ?? false}
                onCheckedChange={next => toggle(channel.id, next)}
                disabled={!editable}
              />
            </div>
          ))}
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
};
