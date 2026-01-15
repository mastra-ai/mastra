import { useState, useMemo } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Label } from '@/ds/components/Label';
import { ChevronDown, ChevronRight, Plus, Trash2, Copy, GripVertical, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

type StringFormat = 'date-time' | 'date' | 'time' | 'email' | 'uri' | 'uuid' | '';

interface SchemaField {
  id: string; // Unique ID for drag-drop
  name: string;
  type: JsonSchemaType;
  description?: string;
  required: boolean;
  properties?: SchemaField[];
  items?: { type: JsonSchemaType };
  // String-specific
  format?: StringFormat;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  // Number-specific
  minimum?: number;
  maximum?: number;
  // Default value
  default?: string | number | boolean;
}

/** Represents a single property definition in a JSON Schema */
interface JsonSchemaProperty {
  type: JsonSchemaType;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: { type: JsonSchemaType };
  format?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: unknown;
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

let fieldIdCounter = 0;
function generateFieldId(): string {
  return `field-${Date.now()}-${++fieldIdCounter}`;
}

function jsonSchemaToFields(schema: Record<string, unknown>): SchemaField[] {
  const jsonSchema = schema as unknown as JsonSchema;

  if (!jsonSchema.properties || typeof jsonSchema.properties !== 'object') {
    return [];
  }

  const required = Array.isArray(jsonSchema.required) ? jsonSchema.required : [];

  return Object.entries(jsonSchema.properties).map(([name, prop]) => {
    const propObj = (prop && typeof prop === 'object' ? prop : {}) as Record<string, unknown>;

    const field: SchemaField = {
      id: generateFieldId(),
      name,
      type: (propObj.type as JsonSchemaType) || 'string',
      description: propObj.description as string | undefined,
      required: required.includes(name),
    };

    // String-specific fields
    if (propObj.format) field.format = propObj.format as StringFormat;
    if (propObj.enum) field.enum = propObj.enum as string[];
    if (propObj.minLength !== undefined) field.minLength = propObj.minLength as number;
    if (propObj.maxLength !== undefined) field.maxLength = propObj.maxLength as number;

    // Number-specific fields
    if (propObj.minimum !== undefined) field.minimum = propObj.minimum as number;
    if (propObj.maximum !== undefined) field.maximum = propObj.maximum as number;

    // Default value
    if (propObj.default !== undefined) {
      field.default = propObj.default as string | number | boolean;
    }

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

    // String-specific
    if (field.type === 'string') {
      if (field.format) prop.format = field.format;
      if (field.enum && field.enum.length > 0) prop.enum = field.enum;
      if (field.minLength !== undefined) prop.minLength = field.minLength;
      if (field.maxLength !== undefined) prop.maxLength = field.maxLength;
    }

    // Number/integer-specific
    if (field.type === 'number' || field.type === 'integer') {
      if (field.minimum !== undefined) prop.minimum = field.minimum;
      if (field.maximum !== undefined) prop.maximum = field.maximum;
    }

    // Default value
    if (field.default !== undefined) {
      prop.default = field.default;
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

function findDuplicateNames(fields: SchemaField[]): Set<string> {
  const names = fields.map(f => f.name);
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const name of names) {
    if (seen.has(name)) {
      duplicates.add(name);
    }
    seen.add(name);
  }

  return duplicates;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_OPTIONS: { value: JsonSchemaType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

const FORMAT_OPTIONS: { value: StringFormat; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'email', label: 'Email' },
  { value: 'uri', label: 'URI' },
  { value: 'uuid', label: 'UUID' },
  { value: 'date-time', label: 'Date-Time' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
];

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

// ============================================================================
// Field Row Component
// ============================================================================

interface FieldRowProps {
  field: SchemaField;
  onUpdate: (field: SchemaField) => void;
  onDelete: () => void;
  onCopy: () => void;
  isDuplicate: boolean;
  depth?: number;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  showDragHandle?: boolean;
}

function FieldRow({
  field,
  onUpdate,
  onDelete,
  onCopy,
  isDuplicate,
  depth = 0,
  dragHandleProps,
  showDragHandle = true,
}: FieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasChildren = field.type === 'object' && field.properties;
  const hasEnumEnabled = field.type === 'string' && field.enum !== undefined;

  const handleTypeChange = (type: JsonSchemaType) => {
    const updated: SchemaField = { ...field, type };
    // Clear type-specific fields when changing type
    delete updated.format;
    delete updated.enum;
    delete updated.minLength;
    delete updated.maxLength;
    delete updated.minimum;
    delete updated.maximum;
    delete updated.default;

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
  };

  const handleAddNestedField = () => {
    const newField: SchemaField = {
      id: generateFieldId(),
      name: `field${(field.properties?.length || 0) + 1}`,
      type: 'string',
      required: false,
    };
    onUpdate({
      ...field,
      properties: [...(field.properties || []), newField],
    });
  };

  const handleUpdateNestedField = (index: number, updated: SchemaField) => {
    const newProperties = [...(field.properties || [])];
    newProperties[index] = updated;
    onUpdate({ ...field, properties: newProperties });
  };

  const handleDeleteNestedField = (index: number) => {
    const newProperties = (field.properties || []).filter((_, i) => i !== index);
    onUpdate({ ...field, properties: newProperties });
  };

  const handleCopyNestedField = (index: number) => {
    const original = field.properties?.[index];
    if (!original) return;
    const copy: SchemaField = {
      ...original,
      id: generateFieldId(),
      name: `${original.name}_copy`,
    };
    const newProperties = [...(field.properties || [])];
    newProperties.splice(index + 1, 0, copy);
    onUpdate({ ...field, properties: newProperties });
  };

  const nestedDuplicates = useMemo(
    () => (field.properties ? findDuplicateNames(field.properties) : new Set<string>()),
    [field.properties],
  );

  const handleNestedDragEnd = (result: DropResult) => {
    if (!result.destination || !field.properties) return;

    const items = Array.from(field.properties);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onUpdate({ ...field, properties: items });
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-surface1',
        isDuplicate ? 'border-amber-500/50' : 'border-border1',
        depth > 0 && 'ml-4',
      )}
    >
      <div className="p-3 space-y-3">
        {/* Row 1: Drag handle, field name, copy, delete */}
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          {showDragHandle && (
            <div {...dragHandleProps} className="text-icon3 cursor-grab active:cursor-grabbing flex-shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
          )}

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

          {/* Field name input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={field.name}
              onChange={e => onUpdate({ ...field, name: e.target.value })}
              placeholder="fieldName"
              style={inputStyle}
              className={cn(
                'w-full h-9 px-3 text-sm font-mono rounded border focus:outline-none focus:border-accent1',
                isDuplicate && 'border-amber-500/50 pr-8',
              )}
            />
            {isDuplicate && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2" title="Duplicate field name">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
            )}
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={onCopy}
            className="h-9 w-9 flex items-center justify-center text-icon4 hover:text-accent1 hover:bg-accent1/10 rounded border border-border1 hover:border-accent1/30 transition-colors flex-shrink-0"
            title="Duplicate field"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={onDelete}
            className="h-9 w-9 flex items-center justify-center text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded border border-border1 hover:border-red-500/30 transition-colors flex-shrink-0"
            title="Delete field"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: Type, Required toggle */}
        <div className="flex items-center gap-2 flex-wrap">
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
                <option value="integer">Integer</option>
                <option value="boolean">Boolean</option>
              </select>
            </>
          )}

          {/* String format */}
          {field.type === 'string' && !hasEnumEnabled && (
            <select
              value={field.format || ''}
              onChange={e => onUpdate({ ...field, format: (e.target.value as StringFormat) || undefined })}
              style={selectStyle}
              className="h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer flex-shrink-0"
            >
              {FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'h-8 px-3 text-xs rounded border transition-colors flex-shrink-0',
              showAdvanced
                ? 'bg-surface4 text-icon5 border-border1'
                : 'bg-surface2 text-icon4 border-border1 hover:border-icon3',
            )}
          >
            {showAdvanced ? 'Less' : 'More'}
          </button>

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

        {/* Advanced options */}
        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-border1">
            {/* Enum for strings */}
            {field.type === 'string' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasEnumEnabled) {
                        onUpdate({ ...field, enum: undefined, format: undefined });
                      } else {
                        onUpdate({ ...field, enum: [], format: undefined });
                      }
                    }}
                    className={cn(
                      'h-7 px-2 text-[10px] rounded border transition-colors',
                      hasEnumEnabled
                        ? 'bg-accent1/20 text-accent1 border-accent1/30'
                        : 'bg-surface2 text-icon4 border-border1 hover:border-icon3',
                    )}
                  >
                    Enum
                  </button>
                  <span className="text-[10px] text-icon3">Restrict to specific values</span>
                </div>
                {hasEnumEnabled && (
                  <input
                    type="text"
                    value={(field.enum || []).join(', ')}
                    onChange={e => {
                      const values = e.target.value
                        .split(',')
                        .map(v => v.trim())
                        .filter(Boolean);
                      onUpdate({ ...field, enum: values.length > 0 ? values : [] });
                    }}
                    placeholder="value1, value2, value3"
                    style={inputStyle}
                    className="w-full h-8 px-3 text-xs rounded border focus:outline-none focus:border-accent1"
                  />
                )}
              </div>
            )}

            {/* String constraints */}
            {field.type === 'string' && !hasEnumEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-icon4 w-16">Length:</span>
                <input
                  type="number"
                  value={field.minLength ?? ''}
                  onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    onUpdate({ ...field, minLength: val });
                  }}
                  placeholder="min"
                  style={inputStyle}
                  className="w-20 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                />
                <span className="text-[10px] text-icon4">to</span>
                <input
                  type="number"
                  value={field.maxLength ?? ''}
                  onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    onUpdate({ ...field, maxLength: val });
                  }}
                  placeholder="max"
                  style={inputStyle}
                  className="w-20 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                />
              </div>
            )}

            {/* Number/integer constraints */}
            {(field.type === 'number' || field.type === 'integer') && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-icon4 w-16">Range:</span>
                <input
                  type="number"
                  value={field.minimum ?? ''}
                  onChange={e => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    onUpdate({ ...field, minimum: val });
                  }}
                  placeholder="min"
                  style={inputStyle}
                  className="w-20 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                />
                <span className="text-[10px] text-icon4">to</span>
                <input
                  type="number"
                  value={field.maximum ?? ''}
                  onChange={e => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    onUpdate({ ...field, maximum: val });
                  }}
                  placeholder="max"
                  style={inputStyle}
                  className="w-20 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                />
              </div>
            )}

            {/* Default value */}
            {field.type !== 'object' && field.type !== 'array' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-icon4 w-16">Default:</span>
                {field.type === 'boolean' ? (
                  <select
                    value={field.default === undefined ? '' : String(field.default)}
                    onChange={e => {
                      const val = e.target.value;
                      onUpdate({
                        ...field,
                        default: val === '' ? undefined : val === 'true',
                      });
                    }}
                    style={selectStyle}
                    className="h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : field.type === 'number' || field.type === 'integer' ? (
                  <input
                    type="number"
                    value={(field.default as number) ?? ''}
                    onChange={e => {
                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                      onUpdate({ ...field, default: val });
                    }}
                    placeholder="default value"
                    style={inputStyle}
                    className="flex-1 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                  />
                ) : (
                  <input
                    type="text"
                    value={(field.default as string) ?? ''}
                    onChange={e => {
                      onUpdate({ ...field, default: e.target.value || undefined });
                    }}
                    placeholder="default value"
                    style={inputStyle}
                    className="flex-1 h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nested fields for object type */}
      {hasChildren && isExpanded && (
        <div className="border-t border-border1 p-3 bg-surface2/30 space-y-2">
          <DragDropContext onDragEnd={handleNestedDragEnd}>
            <Droppable droppableId={`nested-${field.id}`}>
              {provided => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {field.properties?.map((nestedField, index) => (
                    <Draggable key={nestedField.id} draggableId={nestedField.id} index={index}>
                      {provided => (
                        <div ref={provided.innerRef} {...provided.draggableProps} style={provided.draggableProps.style}>
                          <FieldRow
                            field={nestedField}
                            onUpdate={updated => handleUpdateNestedField(index, updated)}
                            onDelete={() => handleDeleteNestedField(index)}
                            onCopy={() => handleCopyNestedField(index)}
                            isDuplicate={nestedDuplicates.has(nestedField.name)}
                            depth={depth + 1}
                            dragHandleProps={provided.dragHandleProps}
                            showDragHandle={(field.properties?.length || 0) > 1}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

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
  const duplicateNames = useMemo(() => findDuplicateNames(fields), [fields]);

  const handleViewModeChange = (mode: 'visual' | 'json') => {
    if (mode === 'json') {
      setJsonValue(JSON.stringify(schema, null, 2));
      setJsonError(null);
    }
    setViewMode(mode);
  };

  const handleJsonChange = (value: string) => {
    setJsonValue(value);
    setJsonError(null);
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  const handleAddField = () => {
    const newField: SchemaField = {
      id: generateFieldId(),
      name: `field${fields.length + 1}`,
      type: 'string',
      required: false,
    };
    const newSchema = fieldsToJsonSchema([...fields, newField]);
    onChange(newSchema);
  };

  const handleUpdateField = (index: number, updated: SchemaField) => {
    const newFields = [...fields];
    newFields[index] = updated;
    onChange(fieldsToJsonSchema(newFields));
  };

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(fieldsToJsonSchema(newFields));
  };

  const handleCopyField = (index: number) => {
    const original = fields[index];
    const copy: SchemaField = {
      ...original,
      id: generateFieldId(),
      name: `${original.name}_copy`,
    };
    const newFields = [...fields];
    newFields.splice(index + 1, 0, copy);
    onChange(fieldsToJsonSchema(newFields));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(fieldsToJsonSchema(items));
  };

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
          {duplicateNames.size > 0 && (
            <span className="text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3 inline" /> Duplicates
            </span>
          )}
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
              {/* Fields list with drag-drop */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="schema-fields">
                  {provided => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {fields.map((field, index) => (
                        <Draggable key={field.id} draggableId={field.id} index={index}>
                          {provided => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                            >
                              <FieldRow
                                field={field}
                                onUpdate={updated => handleUpdateField(index, updated)}
                                onDelete={() => handleDeleteField(index)}
                                onCopy={() => handleCopyField(index)}
                                isDuplicate={duplicateNames.has(field.name)}
                                dragHandleProps={provided.dragHandleProps}
                                showDragHandle={fields.length > 1}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

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
