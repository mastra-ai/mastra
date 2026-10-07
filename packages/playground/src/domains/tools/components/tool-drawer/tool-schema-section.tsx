import { SettingsContainer, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { ToolSectionHeader } from '../tool-section-header';
import { ToolSchemaRows } from './tool-schema-rows';
import type { ToolSchemaRowsProps } from './tool-schema-rows';

export interface ToolSchemaSectionProps extends ToolSchemaRowsProps {
  title: string;
}

/** One schema (input, output, request context) as a Settings group: a row per field, type on the right. */
export function ToolSchemaSection({ title, ...rows }: ToolSchemaSectionProps) {
  return (
    <SettingsGroup>
      <ToolSectionHeader>
        <SettingsTitle>{title}</SettingsTitle>
      </ToolSectionHeader>
      <SettingsContainer>
        <ToolSchemaRows {...rows} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
