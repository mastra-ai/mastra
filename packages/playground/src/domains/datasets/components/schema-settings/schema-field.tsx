'use client';

import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldError } from '@mastra/playground-ui/components/Field';
import { useState, useEffect, useRef } from 'react';

interface SchemaFieldProps {
  label: string;
  value: Record<string, unknown> | null | undefined;
  onChange: (schema: Record<string, unknown> | null) => void;
  error?: string;
}

const format = (value: Record<string, unknown> | null | undefined) => (value ? JSON.stringify(value, null, 2) : '');

/**
 * JSON editor for one schema. An empty editor means no schema (null).
 * JSON parsing errors are shown inline and keep the last valid schema.
 */
export function SchemaField({ label, value, onChange, error }: SchemaFieldProps) {
  const [jsonText, setJsonText] = useState(() => format(value));
  const [parseError, setParseError] = useState<string | null>(null);
  // The schema this editor last produced; anything else comes from outside (e.g. import from a source).
  const lastEmittedRef = useRef(value ?? null);

  useEffect(() => {
    if ((value ?? null) === lastEmittedRef.current) return;
    lastEmittedRef.current = value ?? null;
    setJsonText(format(value));
    setParseError(null);
  }, [value]);

  const emit = (schema: Record<string, unknown> | null) => {
    lastEmittedRef.current = schema;
    onChange(schema);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    if (text.trim() === '') {
      setParseError(null);
      emit(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        setParseError(null);
        emit(parsed);
      } else {
        setParseError('Schema must be a JSON object');
      }
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const errorMessage = parseError ?? error;

  return (
    <Field invalid={Boolean(errorMessage)}>
      <CodeEditor
        aria-label={label}
        value={jsonText}
        onChange={handleJsonChange}
        placeholder="Leave empty for no schema"
        showCopyButton={false}
        className="h-48"
      />
      <FieldError>{errorMessage}</FieldError>
    </Field>
  );
}
