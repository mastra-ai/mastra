import { SettingsContainer, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { ToolSchemaRows } from './tool-schema-rows';
import type { ToolSchemaRowsProps } from './tool-schema-rows';

export interface ToolSchemaSectionProps extends ToolSchemaRowsProps {
  title: string;
}

/** One schema (input, output, request context) as a Settings group: a row per field, type on the right. */
export function ToolSchemaSection({ title, ...rows }: ToolSchemaSectionProps) {
  return (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>{title}</SettingsTitle>
      </SettingsHeader>
      <SettingsContainer>
        <ToolSchemaRows {...rows} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
