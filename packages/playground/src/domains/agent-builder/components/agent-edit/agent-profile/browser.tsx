import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GlobeIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface BrowserProps {
  editable?: boolean;
}

const TOGGLE_ID = 'agent-browser-toggle';

export const Browser = ({ editable = true }: BrowserProps) => {
  const { control, setValue } = useFormContext<AgentBuilderEditFormValues>();
  const browserEnabled = useWatch({ control, name: 'browserEnabled' }) ?? false;
  const agentColor = useAgentColor();

  const handleCheckedChange = (next: boolean) => {
    if (!editable) return;
    setValue('browserEnabled', next, { shouldDirty: true });
  };

  const iconStyle: CSSProperties = { backgroundColor: agentColor.background, color: agentColor.foreground };

  const switchStyle: CSSProperties | undefined = browserEnabled ? { backgroundColor: agentColor.tint } : undefined;

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-8" data-testid="browser-detail-picker">
      <div className="flex w-full max-w-[28rem] flex-col items-center gap-5 text-center">
        <div className="grid size-14 place-items-center rounded-full" style={iconStyle}>
          <GlobeIcon className="h-7 w-7" />
        </div>

        <div className="flex flex-col gap-2">
          <Txt variant="header-sm" className="text-neutral6 font-semibold">
            Browser access
          </Txt>
          <Txt variant="ui-md" className="text-neutral3">
            Let this agent open a browser session to navigate websites, fill out forms, and read live web content as
            part of a run.
          </Txt>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <Switch
            id={TOGGLE_ID}
            checked={browserEnabled}
            onCheckedChange={handleCheckedChange}
            disabled={!editable}
            data-testid={TOGGLE_ID}
            style={switchStyle}
          />
          <label htmlFor={TOGGLE_ID} className="text-ui-md text-neutral6 cursor-pointer font-medium">
            Enable browser
          </label>
          <StatusBadge variant={browserEnabled ? 'success' : 'neutral'} size="sm" withDot>
            {browserEnabled ? 'Enabled' : 'Disabled'}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
};
