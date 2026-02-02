'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/ds/components/Switch';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { SchemaImport } from './schema-import';
import { cn } from '@/lib/utils';

interface SchemaFieldProps {
  label: string;
  schemaType: 'input' | 'output';
  value: Record<string, unknown> | null | undefined;
  onChange: (schema: Record<string, unknown> | null) => void;
  error?: string;
}

/**
 * Schema field with toggle, JSON editor, and workflow import.
 * Toggle enables/disables the schema (null = disabled).
 * JSON parsing errors shown inline.
 */
export function SchemaField({ label, schemaType, value, onChange, error }: SchemaFieldProps) {
  const isEnabled = value !== null && value !== undefined;
  const [jsonText, setJsonText] = useState(() => (value ? JSON.stringify(value, null, 2) : ''));
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync jsonText when value changes from outside (e.g., import)
  useEffect(() => {
    if (value) {
      setJsonText(JSON.stringify(value, null, 2));
      setParseError(null);
    }
  }, [value]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Enable with default empty object schema
      onChange({ type: 'object', properties: {} });
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
        onChange(parsed);
      } else {
        setParseError('Schema must be a JSON object');
      }
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const handleImport = (schema: Record<string, unknown>) => {
    onChange(schema);
    setJsonText(JSON.stringify(schema, null, 2));
    setParseError(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={isEnabled} onCheckedChange={handleToggle} id={`${schemaType}-schema-toggle`} />
          <label htmlFor={`${schemaType}-schema-toggle`} className="text-sm font-medium">
            {label}
          </label>
        </div>

        {isEnabled && <SchemaImport schemaType={schemaType} onImport={handleImport} />}
      </div>

      {isEnabled && (
        <div className="space-y-2">
          <CodeEditor
            value={jsonText}
            onChange={handleJsonChange}
            showCopyButton={false}
            className={cn('h-48 border rounded-md', (parseError || error) && 'border-destructive')}
          />
          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          {error && !parseError && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
