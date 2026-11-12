import { SettingsEmptyRow } from '@mastra/playground-ui/new/settings';

export interface ToolSettingsEmptyRowProps {
  message: string;
}

/** The only row of an empty Settings container (no fields, no agents). */
export function ToolSettingsEmptyRow({ message }: ToolSettingsEmptyRowProps) {
  return <SettingsEmptyRow>{message}</SettingsEmptyRow>;
}
