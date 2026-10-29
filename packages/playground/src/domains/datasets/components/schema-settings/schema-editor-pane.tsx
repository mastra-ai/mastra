import { Card } from '@mastra/playground-ui/components/Card';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import {
  JSONSchemaForm,
  fieldsToJSONSchema,
  jsonSchemaToFields,
} from '@mastra/playground-ui/components/JSONSchemaForm';
import type { SchemaField } from '@mastra/playground-ui/components/JSONSchemaForm';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import { Ajv } from 'ajv';
import { useRef, useState } from 'react';

type SchemaValue = Record<string, unknown> | null;

export interface SchemaEditorPaneProps {
  label: string;
  value: SchemaValue;
  onChange: (schema: SchemaValue) => void;
  onValidityChange: (valid: boolean) => void;
}

const stringify = (schema: SchemaValue) => (schema ? JSON.stringify(schema, null, 2) : '');

const hasProperties = (schema: JsonSchema) => Object.keys(schema.properties ?? {}).length > 0;

const toFields = (schema: SchemaValue) => jsonSchemaToFields(schema ?? undefined);

// Datasets compile schemas as draft-07, so hand-written JSON is checked against that meta-schema.
const DRAFT_07_META_SCHEMA = 'http://json-schema.org/draft-07/schema';
const ajv = new Ajv();

function getSchemaError(schema: Record<string, unknown>): string | null {
  if (ajv.validate(DRAFT_07_META_SCHEMA, schema)) return null;
  const [error] = ajv.errors ?? [];
  return `Invalid JSON Schema: ${error?.instancePath || '/'} ${error?.message ?? 'is not valid'}`;
}

function parseSchemaText(text: string): { schema: SchemaValue; error: string | null } {
  if (!text.trim()) return { schema: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { schema: null, error: 'Invalid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { schema: null, error: 'Schema must be a JSON object' };
  }
  const schema = parsed as Record<string, unknown>;
  return { schema, error: getSchemaError(schema) };
}

/**
 * Edits one JSON Schema two ways: the visual field editor on the left, raw JSON on the right.
 * The visual editor only owns its initial fields, so a JSON edit remounts it with the parsed fields.
 */
export function SchemaEditorPane({ label, value, onChange, onValidityChange }: SchemaEditorPaneProps) {
  const [jsonText, setJsonText] = useState(() => stringify(value));
  const [parseError, setParseError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ key: 0, fields: toFields(value) }));
  // The visual editor reports its hydrated schema on mount; that echo must not overwrite the JSON it came from.
  const mountEchoRef = useRef<string | null>(JSON.stringify(fieldsToJSONSchema(form.fields)));

  const remountForm = (fields: SchemaField[]) => {
    mountEchoRef.current = JSON.stringify(fieldsToJSONSchema(fields));
    setForm(previous => ({ key: previous.key + 1, fields }));
  };

  const handleFormChange = (schema: JsonSchema) => {
    const isMountEcho = JSON.stringify(schema) === mountEchoRef.current;
    mountEchoRef.current = null;
    if (isMountEcho) return;

    const next = hasProperties(schema) ? (schema as Record<string, unknown>) : null;
    setJsonText(stringify(next));
    if (parseError) {
      setParseError(null);
      onValidityChange(true);
    }
    onChange(next);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    const { schema, error } = parseSchemaText(text);
    setParseError(error);
    onValidityChange(!error);
    if (error) return;

    onChange(schema);
    remountForm(toFields(schema));
  };

  const hasJson = Boolean(jsonText.trim());

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="min-h-0 rounded-md p-3 md:overflow-y-auto">
        <JSONSchemaForm.Root key={form.key} defaultValue={form.fields} onChange={handleFormChange} maxDepth={5}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <SchemaFieldRow key={field.id} field={field} parentPath={parentPath} depth={depth} />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="ghost" size="sm" className="mt-2">
            Add field
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
      </Card>

      <Field invalid={Boolean(parseError)} className="flex min-h-0 flex-col">
        <FieldLabel className="sr-only">{`${label} JSON`}</FieldLabel>
        <CodeEditor
          value={jsonText}
          onChange={handleJsonChange}
          showCopyButton={hasJson}
          showFormatButton={hasJson}
          className={cn('min-h-80 flex-1 rounded-md border', parseError && 'border-destructive-indicator')}
        />
        <FieldError>{parseError}</FieldError>
      </Field>
    </div>
  );
}

function SchemaFieldRow({ field, parentPath, depth }: { field: SchemaField; parentPath: string[]; depth: number }) {
  return (
    <JSONSchemaForm.Field field={field} parentPath={parentPath} depth={depth}>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <JSONSchemaForm.FieldName placeholder="Field name" className="min-w-0 flex-1" />
          <JSONSchemaForm.FieldType placeholder="Type" />
        </div>
        <div className="flex items-center gap-2">
          <JSONSchemaForm.FieldOptional />
          <JSONSchemaForm.FieldNullable />
          <JSONSchemaForm.FieldRemove variant="ghost" />
        </div>
      </div>
      <JSONSchemaForm.NestedFields className="border-l border-border pl-3">
        <JSONSchemaForm.FieldList>
          {(nestedField, _index, nestedContext) => (
            <SchemaFieldRow
              key={nestedField.id}
              field={nestedField}
              parentPath={nestedContext.parentPath}
              depth={nestedContext.depth}
            />
          )}
        </JSONSchemaForm.FieldList>
        <JSONSchemaForm.AddField variant="ghost" size="sm">
          Add nested field
        </JSONSchemaForm.AddField>
      </JSONSchemaForm.NestedFields>
    </JSONSchemaForm.Field>
  );
}
