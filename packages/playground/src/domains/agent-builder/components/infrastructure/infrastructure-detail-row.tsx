import { SettingsRow } from '@mastra/playground-ui/new/settings';

export interface InfrastructureDetailRowProps {
  label: string;
  value: string | number;
}

export const InfrastructureDetailRow = ({ label, value }: InfrastructureDetailRowProps) => (
  <SettingsRow label={label}>
    <span className="truncate text-body-sm text-muted-foreground">{value}</span>
  </SettingsRow>
);
