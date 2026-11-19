import { SettingsItem } from '@mastra/playground-ui/new/settings';

export interface InfrastructureDetailRowProps {
  label: string;
  value: string | number;
}

export const InfrastructureDetailRow = ({ label, value }: InfrastructureDetailRowProps) => (
  <SettingsItem title={label}>
    <span className="truncate text-body-sm text-muted-foreground">{value}</span>
  </SettingsItem>
);
