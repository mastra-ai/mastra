import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent } from '../../../../ds/components/Collapsible';
import { Switch } from '../../../../ds/components/Switch';
import { SettingsRow } from '../../../../ds/new/settings';

export interface CollapsibleSettingsRowProps {
  label: string;
  description: ReactNode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  errorMsg?: ReactNode;
  children: ReactNode;
}

/**
 * A settings row whose switch is the only way to open it. The content stays mounted while closed, so switching
 * an option back on restores what was entered.
 */
export function CollapsibleSettingsRow({
  label,
  description,
  enabled,
  onEnabledChange,
  errorMsg,
  children,
}: CollapsibleSettingsRowProps) {
  return (
    <div>
      <SettingsRow label={label} description={description} errorMsg={errorMsg}>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </SettingsRow>
      <Collapsible open={enabled}>
        <CollapsibleContent keepMounted>
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
