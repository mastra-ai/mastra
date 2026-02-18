'use client';

import { useState, useEffect, useRef } from 'react';
import { Switch } from '@/ds/components/Switch';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { cn } from '@/lib/utils';
import type { JSONSchema7 } from 'json-schema';

interface SchemaFieldProps {
  label: string;
  schemaType: 'input' | 'output';
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
export function SchemaField({
  label,
  schemaType,
  value,
  onChange,
  error,
  sourceSchema,
  autoPopulate = false,
}: SchemaFieldProps) {
  const isEnabled = value !== null && value !== undefined;
  const [jsonText, setJsonText] = useState(() => (value ? JSON.stringify(value, null, 2) : ''));
  const [parseError, setParseError] = useState<string | null>(null);
  // Track if we've already auto-populated to avoid repeated population on re-enable
  const hasAutoPopulatedRef = useRef(false);

  // Sync jsonText when value changes from outside (e.g., import)
  useEffect(() => {
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
        onChange(parsed);
      } else {
        setParseError('Schema must be a JSON object');
      }
    } catch {
      setParseError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch checked={isEnabled} onCheckedChange={handleToggle} id={`${schemaType}-schema-toggle`} />
        <label htmlFor={`${schemaType}-schema-toggle`} className="text-sm font-medium">
          {label}
        </label>
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
