import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import {
  describeSchemaType,
  getSchemaFields,
  isDictionarySchema,
  isEmptySchema,
  isObjectSchema,
} from '../../utils/get-schema-fields';
import { ToolSchemaFieldRow } from './tool-schema-field-row';
import { ToolSettingsEmptyRow } from './tool-settings-empty-row';

export interface ToolSchemaRowsProps {
  schema: unknown;
  emptyMessage: string;
  /** Mark defaulted fields optional; set for schemas the caller fills in (input, request context). */
  defaultsAreOptional?: boolean;
}

export function ToolSchemaRows({ schema, emptyMessage, defaultsAreOptional }: ToolSchemaRowsProps) {
  if (isEmptySchema(schema)) return <ToolSettingsEmptyRow message={emptyMessage} />;

  // A non-object (or a dictionary, which has no named fields) reads as its type, e.g. `Record<string, string>`.
  if (!isObjectSchema(schema) || isDictionarySchema(schema)) {
    return (
      <SettingsRow label="Type">
        <Txt as="span" variant="caption" font="mono" tone="muted">
          {describeSchemaType(schema)}
        </Txt>
      </SettingsRow>
    );
  }

  const fields = getSchemaFields(schema, { defaultsAreOptional });
  if (fields.length === 0) return <ToolSettingsEmptyRow message={emptyMessage} />;

  return fields.map(field => <ToolSchemaFieldRow key={field.name} field={field} />);
}
