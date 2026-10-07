import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { SchemaField } from '../../utils/get-schema-fields';
import { RequiredMark } from '../required-mark';
import { ToolSchemaFieldDescription } from './tool-schema-field-description';

export interface ToolSchemaFieldRowProps {
  field: SchemaField;
}

/** One schema field: mono name with a required asterisk, its description, and the type on the right. */
export function ToolSchemaFieldRow({ field }: ToolSchemaFieldRowProps) {
  const hasDescription = Boolean(field.description) || field.defaultValue !== undefined;

  return (
    <SettingsRow
      label={
        <Txt as="span" variant="body-sm" font="mono" tone="ink">
          {field.name}
          {field.required && <RequiredMark />}
        </Txt>
      }
      description={hasDescription && <ToolSchemaFieldDescription field={field} />}
    >
      <Txt as="span" variant="caption" font="mono" tone="muted">
        {field.type}
      </Txt>
    </SettingsRow>
  );
}
