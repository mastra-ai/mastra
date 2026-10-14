import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

export interface ToolSettingsEmptyRowProps {
  message: string;
}

/** A muted single-line row for an empty Settings container (no fields, no agents). */
export function ToolSettingsEmptyRow({ message }: ToolSettingsEmptyRowProps) {
  return (
    <SettingsRow
      label={
        <Txt as="span" variant="body-sm" tone="muted">
          {message}
        </Txt>
      }
    />
  );
}
