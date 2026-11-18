import { SettingsItem, SettingsValue } from '@mastra/playground-ui/new/settings';

export interface InfrastructureDetailRowProps {
  label: string;
  value: string | number;
}

export const InfrastructureDetailRow = ({ label, value }: InfrastructureDetailRowProps) => (
  <SettingsItem title={label}>
    <SettingsValue>{value}</SettingsValue>
  </SettingsItem>
);
