import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  describeSchemaType,
  getSchemaFields,
  isDictionarySchema,
  isEmptySchema,
  isObjectSchema,
} from '../utils/get-schema-fields';
import { ToolSchemaFieldRow } from './tool-schema-field-row';

export interface ToolSchemaFieldsProps {
  schema: unknown;
  /** Shown when there is no schema, or an object schema has no fields. */
  emptyMessage: string;
  /** Mark defaulted fields optional; set for schemas the caller fills in (input, request context). */
  defaultsAreOptional?: boolean;
}

export function ToolSchemaFields({ schema, emptyMessage, defaultsAreOptional }: ToolSchemaFieldsProps) {
  if (isEmptySchema(schema)) {
    return (
      <Txt variant="caption" tone="muted">
        {emptyMessage}
      </Txt>
    );
  }

  // A dictionary has no named fields, so it reads as its type, e.g. `Record<string, string>`.
  if (!isObjectSchema(schema) || isDictionarySchema(schema)) {
    return (
      <Txt variant="caption" tone="muted">
        Type{' '}
        <Txt as="span" variant="caption" font="mono" tone="ink">
          {describeSchemaType(schema)}
        </Txt>
      </Txt>
    );
  }

  const fields = getSchemaFields(schema, { defaultsAreOptional });
  if (fields.length === 0) {
    return (
      <Txt variant="caption" tone="muted">
        {emptyMessage}
      </Txt>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {fields.map(field => (
        <ToolSchemaFieldRow key={field.name} field={field} />
      ))}
    </ul>
  );
}
