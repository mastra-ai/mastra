import type { SchemaField } from '../../utils/get-schema-fields';

export interface ToolSchemaFieldDescriptionProps {
  field: SchemaField;
}

/** A field's description, with its default on a line of its own. */
export function ToolSchemaFieldDescription({ field }: ToolSchemaFieldDescriptionProps) {
  return (
    <>
      {field.description}
      {field.defaultValue !== undefined && <span className="block">Default {field.defaultValue}</span>}
    </>
  );
}
