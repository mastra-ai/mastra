import { useState, useCallback, useMemo } from 'react';
import { Label } from '@/ds/components/Label';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type JsonSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface SchemaField {
  name: string;
  type: JsonSchemaType;
  description?: string;
  required: boolean;
  properties?: SchemaField[];
  items?: { type: JsonSchemaType };
}

/** Represents a single property definition in a JSON Schema */
interface JsonSchemaProperty {
  type: JsonSchemaType;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: { type: JsonSchemaType };
}

interface JsonSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

// ============================================================================
// Props
// ============================================================================

export interface VisualSchemaEditorProps {
  label: string;
  description: string;
  schema: Record<string, unknown>;
  onChange: (schema: Record<string, unknown>) => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function jsonSchemaToFields(schema: Record<string, unknown>): SchemaField[] {
  const jsonSchema = schema as unknown as JsonSchema;

  if (!jsonSchema.properties || typeof jsonSchema.properties !== 'object') {
    return [];
  }

  const required = Array.isArray(jsonSchema.required) ? jsonSchema.required : [];

  return Object.entries(jsonSchema.properties).map(([name, prop]) => {
    const propObj = (prop && typeof prop === 'object' ? prop : {}) as Record<string, unknown>;

    const field: SchemaField = {
      name,
      type: (propObj.type as JsonSchemaType) || 'string',
      description: propObj.description as string | undefined,
      required: required.includes(name),
    };

    if (propObj.type === 'object' && propObj.properties) {
      field.properties = jsonSchemaToFields(propObj as Record<string, unknown>);
    }

    if (propObj.type === 'array' && propObj.items) {
      const items = propObj.items as Record<string, unknown>;
      field.items = { type: (items.type as JsonSchemaType) || 'string' };
    }

    return field;
  });
}

function fieldsToJsonSchema(fields: SchemaField[]): JsonSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: JsonSchemaProperty = { type: field.type };

    if (field.description) {
      prop.description = field.description;
    }

    if (field.type === 'object' && field.properties) {
      const nested = fieldsToJsonSchema(field.properties);
      prop.properties = nested.properties;
      if (nested.required?.length) {
        prop.required = nested.required;
      }
    }

    if (field.type === 'array' && field.items) {
      prop.items = { type: field.items.type };
    }

    properties[field.name] = prop;

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// ============================================================================
// Field Row Component
// ============================================================================

const TYPE_OPTIONS: { value: JsonSchemaType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

interface FieldRowProps {
  field: SchemaField;
  onUpdate: (field: SchemaField) => void;
  onDelete: () => void;
  depth?: number;
}

// Inline styles to guarantee colors work regardless of CSS specificity issues
const inputStyle: React.CSSProperties = {
  color: '#FFFFFF',
  backgroundColor: '#0F0F0F',
  borderColor: 'rgba(48, 48, 48, 1)',
};

const selectStyle: React.CSSProperties = {
  color: '#E6E6E6',
  backgroundColor: '#0F0F0F',
  borderColor: 'rgba(48, 48, 48, 1)',
};

function FieldRow({ field, onUpdate, onDelete, depth = 0 }: FieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = field.type === 'object' && field.properties;

  const handleTypeChange = useCallback(
    (type: JsonSchemaType) => {
      const updated: SchemaField = { ...field, type };
      if (type === 'object' && !field.properties) {
        updated.properties = [];
      }
      if (type === 'array' && !field.items) {
        updated.items = { type: 'string' };
      }
      if (type !== 'object') {
        delete updated.properties;
      }
      if (type !== 'array') {
        delete updated.items;
      }
      onUpdate(updated);
    },
    [field, onUpdate],
  );

  const handleAddNestedField = useCallback(() => {
    const newField: SchemaField = {
      name: `field${(field.properties?.length || 0) + 1}`,
      type: 'string',
      required: false,
    };
    onUpdate({
      ...field,
      properties: [...(field.properties || []), newField],
    });
  }, [field, onUpdate]);

  const handleUpdateNestedField = useCallback(
    (index: number, updated: SchemaField) => {
      const newProperties = [...(field.properties || [])];
      newProperties[index] = updated;
      onUpdate({ ...field, properties: newProperties });
    },
    [field, onUpdate],
  );

  const handleDeleteNestedField = useCallback(
    (index: number) => {
      const newProperties = (field.properties || []).filter((_, i) => i !== index);
      onUpdate({ ...field, properties: newProperties });
    },
    [field, onUpdate],
  );

  return (
    <div className={cn('rounded-md border border-border1 bg-surface1', depth > 0 && 'ml-4')}>
      <div className="p-3 space-y-3">
        {/* Row 1: Field name */}
        <div className="flex items-center gap-2">
          {/* Expand/collapse for objects */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 hover:bg-surface3 rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-icon4" />
              ) : (
                <ChevronRight className="w-4 h-4 text-icon4" />
              )}
            </button>
          ) : null}

          {/* Field name input - full width */}
          <input
            type="text"
            value={field.name}
            onChange={e => onUpdate({ ...field, name: e.target.value })}
            placeholder="fieldName"
            style={inputStyle}
            className="flex-1 h-9 px-3 text-sm font-mono rounded border focus:outline-none focus:border-accent1"
          />

          {/* Delete button */}
          <button
            type="button"
            onClick={onDelete}
            className="h-9 w-9 flex items-center justify-center text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded border border-border1 hover:border-red-500/30 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: Type, Required toggle */}
        <div className="flex items-center gap-2">
          {/* Type selector */}
          <select
            value={field.type}
            onChange={e => handleTypeChange(e.target.value as JsonSchemaType)}
            style={selectStyle}
            className="h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer flex-shrink-0"
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Array item type */}
          {field.type === 'array' && (
            <>
              <span className="text-xs text-icon4">of</span>
              <select
                value={field.items?.type || 'string'}
                onChange={e => onUpdate({ ...field, items: { type: e.target.value as JsonSchemaType } })}
                style={selectStyle}
                className="h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer flex-shrink-0"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </>
          )}

          <div className="flex-1" />

          {/* Required toggle */}
          <button
            type="button"
            onClick={() => onUpdate({ ...field, required: !field.required })}
            className={cn(
              'h-8 px-3 text-xs rounded border transition-colors flex-shrink-0',
              field.required
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-surface2 text-icon4 border-border1 hover:border-icon3',
            )}
          >
            {field.required ? 'Required' : 'Optional'}
          </button>
        </div>

        {/* Row 3: Description */}
        <input
          type="text"
          value={field.description || ''}
          onChange={e => onUpdate({ ...field, description: e.target.value || undefined })}
          placeholder="Description (optional)"
          style={{ ...inputStyle, color: '#A9A9A9' }}
          className="w-full h-8 px-3 text-xs rounded border focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Nested fields for object type */}
      {hasChildren && isExpanded && (
        <div className="border-t border-border1 p-3 bg-surface2/30 space-y-2">
          {field.properties?.map((nestedField, index) => (
            <FieldRow
              key={index}
              field={nestedField}
              onUpdate={updated => handleUpdateNestedField(index, updated)}
              onDelete={() => handleDeleteNestedField(index)}
              depth={depth + 1}
            />
          ))}

          <button
            type="button"
            onClick={handleAddNestedField}
            className="flex items-center gap-1.5 text-xs text-accent1 hover:text-accent1/80 ml-5 py-1"
          >
            <Plus className="w-3 h-3" />
            Add nested field
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VisualSchemaEditor({
  label,
  description,
  schema,
  onChange,
  collapsible = true,
  defaultExpanded = false,
}: VisualSchemaEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fields = useMemo(() => jsonSchemaToFields(schema), [schema]);
  const hasContent = fields.length > 0;

  const handleViewModeChange = useCallback(
    (mode: 'visual' | 'json') => {
      if (mode === 'json') {
        setJsonValue(JSON.stringify(schema, null, 2));
        setJsonError(null);
      }
      setViewMode(mode);
    },
    [schema],
  );

  const handleJsonChange = useCallback(
    (value: string) => {
      setJsonValue(value);
      setJsonError(null);
      try {
        const parsed = JSON.parse(value);
        onChange(parsed);
      } catch {
        setJsonError('Invalid JSON');
      }
    },
    [onChange],
  );

  const handleAddField = useCallback(() => {
    const newField: SchemaField = {
      name: `field${fields.length + 1}`,
      type: 'string',
      required: false,
    };
    const newSchema = fieldsToJsonSchema([...fields, newField]);
    onChange(newSchema);
  }, [fields, onChange]);

  const handleUpdateField = useCallback(
    (index: number, updated: SchemaField) => {
      const newFields = [...fields];
      newFields[index] = updated;
      onChange(fieldsToJsonSchema(newFields));
    },
    [fields, onChange],
  );

  const handleDeleteField = useCallback(
    (index: number) => {
      const newFields = fields.filter((_, i) => i !== index);
      onChange(fieldsToJsonSchema(newFields));
    },
    [fields, onChange],
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-icon4" />
          ) : (
            <ChevronRight className="w-4 h-4 text-icon4" />
          )}
          <Label className="text-xs text-icon5 cursor-pointer font-medium">{label}</Label>
          {hasContent && !isExpanded && <span className="text-xs text-icon3">({fields.length} fields)</span>}
        </button>
      ) : (
        <Label className="text-xs text-icon5 font-medium">{label}</Label>
      )}

      {/* Collapsed description */}
      {!isExpanded && collapsible && <p className="text-[10px] text-icon3 ml-6">{description}</p>}

      {/* Expanded content */}
      {(isExpanded || !collapsible) && (
        <div className={cn(collapsible && 'ml-6', 'space-y-3')}>
          <p className="text-[10px] text-icon3">{description}</p>

          {/* Mode toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleViewModeChange('visual')}
              className={cn(
                'text-xs px-3 py-1 rounded transition-colors',
                viewMode === 'visual' ? 'bg-accent1/20 text-accent1' : 'bg-surface2 text-icon4 hover:text-icon5',
              )}
            >
              Visual
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('json')}
              className={cn(
                'text-xs px-3 py-1 rounded transition-colors',
                viewMode === 'json' ? 'bg-accent1/20 text-accent1' : 'bg-surface2 text-icon4 hover:text-icon5',
              )}
            >
              JSON
            </button>
          </div>

          {viewMode === 'visual' ? (
            <div className="space-y-2">
              {/* Fields list */}
              {fields.map((field, index) => (
                <FieldRow
                  key={index}
                  field={field}
                  onUpdate={updated => handleUpdateField(index, updated)}
                  onDelete={() => handleDeleteField(index)}
                />
              ))}

              {/* Empty state */}
              {fields.length === 0 && (
                <div className="py-6 border border-dashed border-border1 rounded-md text-center">
                  <p className="text-xs text-icon4">No fields defined</p>
                  <p className="text-[10px] text-icon3 mt-1">Click "Add field" to get started</p>
                </div>
              )}

              {/* Add field button */}
              <button
                type="button"
                onClick={handleAddField}
                className="flex items-center gap-1.5 text-xs text-accent1 hover:text-accent1/80 py-2"
              >
                <Plus className="w-4 h-4" />
                Add field
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={jsonValue}
                onChange={e => handleJsonChange(e.target.value)}
                placeholder='{\n  "type": "object",\n  "properties": {}\n}'
                rows={10}
                style={{ color: '#FFFFFF', backgroundColor: '#0F0F0F', borderColor: 'rgba(48, 48, 48, 1)' }}
                className="w-full font-mono text-xs p-3 rounded-md border resize-none focus:outline-none focus:border-accent1"
              />
              {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
