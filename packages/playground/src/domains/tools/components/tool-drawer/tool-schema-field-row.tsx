import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { SchemaField } from '../../utils/get-schema-fields';
import { RequiredMark } from '../required-mark';

export interface ToolSchemaFieldRowProps {
  field: SchemaField;
}

function describeField(field: SchemaField): string {
  const defaultNote = field.defaultValue !== undefined ? `Default ${field.defaultValue}` : undefined;
  return [field.description, defaultNote].filter(Boolean).join(' · ');
}

/** One schema field: mono name with a required asterisk, its description, and the type on the right. */
export function ToolSchemaFieldRow({ field }: ToolSchemaFieldRowProps) {
  return (
    <SettingsRow
      label={
        <Txt as="span" variant="body-sm" font="mono" tone="ink">
          {field.name}
          {field.required && <RequiredMark />}
        </Txt>
      }
      description={describeField(field) || undefined}
    >
      <Txt as="span" variant="caption" font="mono" tone="muted">
        {field.type}
      </Txt>
    </SettingsRow>
  );
}
