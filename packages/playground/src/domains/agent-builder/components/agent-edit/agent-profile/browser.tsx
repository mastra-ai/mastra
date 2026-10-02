import { Badge } from '@mastra/playground-ui/components/Badge';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
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
    <div className="flex h-full min-h-0 items-center justify-center px-4 py-5" data-testid="browser-detail-picker">
      <div className="flex w-full max-w-[28rem] flex-col items-center gap-5 text-center">
        <div className="grid size-14 place-items-center rounded-full" style={iconStyle}>
          <GlobeIcon className="h-7 w-7" />
        </div>

        <div className="flex flex-col gap-2">
          <Txt variant="heading" tone="ink">
            Browser access
          </Txt>
          <Txt variant="body" tone="muted">
            Let this agent open a browser session to navigate websites, fill out forms, and read live web content as
            part of a run.
          </Txt>
        </div>

        <Field orientation="horizontal" disabled={!editable} className="mt-1 gap-3">
          <Switch
            checked={browserEnabled}
            onCheckedChange={handleCheckedChange}
            data-testid={TOGGLE_ID}
            style={switchStyle}
          />
          <FieldLabel size="smaller">Enable browser</FieldLabel>
          <Badge variant={browserEnabled ? 'success' : 'neutral'} size="sm" indicator="dot">
            {browserEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </Field>
      </div>
    </div>
  );
};
