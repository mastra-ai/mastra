import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsItem } from '@mastra/playground-ui/new/settings';
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
    <SettingsItem
      title={
        <Txt as="span" variant="body-sm" font="mono" tone="ink">
          {field.name}
          {field.required && <RequiredMark />}
        </Txt>
      }
      // The description can run to a second line (the default value), so it wraps instead of truncating.
      description={
        hasDescription ? (
          <span className="whitespace-normal">
            <ToolSchemaFieldDescription field={field} />
          </span>
        ) : undefined
      }
    >
      <Txt as="span" variant="caption" font="mono" tone="muted">
        {field.type}
      </Txt>
    </SettingsItem>
  );
}
