import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';

export interface ToolRowProps {
  logo: ReactNode;
  name: string;
  description?: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Set when the tool needs an account it doesn't have yet: the row offers Connect instead of the switch. */
  onConnect?: () => void;
}

export function ToolRow({ logo, name, description, enabled, onEnabledChange, onConnect }: ToolRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex shrink-0">
        {logo}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="label" tone="ink">
          {name}
        </Txt>
        {description ? (
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {description}
          </Txt>
        ) : null}
      </div>
      {onConnect ? (
        <Button size="sm" onClick={onConnect} aria-label={`Connect ${name}`}>
          Connect
        </Button>
      ) : (
        <Switch aria-label={name} checked={enabled} onCheckedChange={onEnabledChange} />
      )}
    </div>
  );
}
