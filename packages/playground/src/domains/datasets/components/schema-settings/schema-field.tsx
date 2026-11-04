'use client';

import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { JSONSchema7 } from 'json-schema';
import { useState, useEffect, useRef } from 'react';

interface SchemaFieldProps {
  label: string;
  value: Record<string, unknown> | null | undefined;
  onChange: (schema: Record<string, unknown> | null) => void;
  error?: string;
  /** Schema to auto-populate when field is enabled */
  sourceSchema?: JSONSchema7 | null;
  /** Whether to auto-populate from sourceSchema when enabled */
  autoPopulate?: boolean;
}

/**
 * Schema field with toggle and JSON editor.
 * Toggle enables/disables the schema (null = disabled).
 * JSON parsing errors shown inline.
 * Supports auto-population from sourceSchema when autoPopulate is true.
 */
export function SchemaField({ label, value, onChange, error, sourceSchema, autoPopulate = false }: SchemaFieldProps) {
  const isEnabled = value !== null && value !== undefined;
  const [jsonText, setJsonText] = useState(() => (value ? JSON.stringify(value, null, 2) : ''));
  const [parseError, setParseError] = useState<string | null>(null);
  // Track if we've already auto-populated to avoid repeated population on re-enable
  const hasAutoPopulatedRef = useRef(false);
  // Track whether the latest value change originated from local editing
  const isLocalEditRef = useRef(false);

  // Sync jsonText when value changes from outside (e.g., import)
  useEffect(() => {
    if (isLocalEditRef.current) {
      isLocalEditRef.current = false;
      return;
    }
    if (value) {
      setJsonText(JSON.stringify(value, null, 2));
      setParseError(null);
    }
  }, [value]);

  // Reset auto-populate flag when sourceSchema changes (new source selected)
  useEffect(() => {
    hasAutoPopulatedRef.current = false;
  }, [sourceSchema]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Auto-populate from sourceSchema if available and not yet populated
      if (autoPopulate && sourceSchema && !hasAutoPopulatedRef.current) {
        hasAutoPopulatedRef.current = true;
        onChange(sourceSchema as Record<string, unknown>);
      } else {
        // Enable with default empty object schema
        onChange({ type: 'object', properties: {} });
      }
    } else {
      // Disable by setting null
      onChange(null);
    }
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        setParseError(null);
        isLocalEditRef.current = true;
        onChange(parsed);
      } else {
        setParseError('Schema must be a JSON object');
      }
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const errorMessage = parseError ?? error;

  return (
    <div className="space-y-3">
      <Field orientation="horizontal">
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        <FieldLabel size="smaller">{label}</FieldLabel>
      </Field>

      {isEnabled && (
        <Field invalid={Boolean(errorMessage)}>
          <FieldLabel className="sr-only">{`${label} JSON`}</FieldLabel>
          <CodeEditor
            value={jsonText}
            onChange={handleJsonChange}
            showCopyButton={false}
            className={cn('h-48 rounded-md border', errorMessage && 'border-destructive-indicator')}
          />
          <FieldError>{errorMessage}</FieldError>
        </Field>
      )}
    </div>
  );
}
