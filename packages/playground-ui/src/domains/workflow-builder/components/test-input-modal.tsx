import { useState, useCallback, useEffect } from 'react';
import { Play, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import { useTestRunnerStore } from '../store/test-runner-store';

// ============================================================================
// Props
// ============================================================================

export interface TestInputModalProps {
  /** Called when user submits the form to run the test */
  onRun: (input: Record<string, unknown>) => Promise<void>;
  /** Optional: Schema to use for resume input (for suspended workflows) */
  resumeSchema?: Record<string, unknown>;
  /** Whether this is a resume action */
  isResume?: boolean;
}

// ============================================================================
// Schema Helpers
// ============================================================================

interface SchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

function getDefaultValue(prop: SchemaProperty): unknown {
  if (prop.default !== undefined) return prop.default;
  switch (prop.type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return '';
  }
}

function parseValue(value: string, type: string | undefined): unknown {
  if (!value) return value;
  switch (type) {
    case 'number':
    case 'integer':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'array':
    case 'object':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  name: string;
  property: SchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
}

function SchemaField({ name, property, value, onChange, required }: FieldProps) {
  const type = property.type || 'string';

  // Boolean field
  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={name}
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border1"
        />
        <Label htmlFor={name} className="text-xs text-icon5">
          {name}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        {property.description && <span className="text-[10px] text-icon3 ml-2">{property.description}</span>}
      </div>
    );
  }

  // Enum field
  if (property.enum && property.enum.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className="text-xs text-icon5">
          {name}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <select
          id={name}
          value={String(value)}
          onChange={e => onChange(parseValue(e.target.value, type))}
          className="w-full h-9 px-3 rounded-md border border-border1 bg-surface2 text-sm text-icon5"
        >
          {property.enum.map((opt, i) => (
            <option key={i} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        {property.description && <p className="text-[10px] text-icon3">{property.description}</p>}
      </div>
    );
  }

  // Object/Array field (JSON editor)
  if (type === 'object' || type === 'array') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className="text-xs text-icon5">
          {name}
          {required && <span className="text-red-400 ml-0.5">*</span>}
          <span className="text-[10px] text-icon3 ml-2">(JSON)</span>
        </Label>
        <Textarea
          id={name}
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={e => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={type === 'array' ? '[]' : '{}'}
          className="font-mono text-xs min-h-[80px]"
        />
        {property.description && <p className="text-[10px] text-icon3">{property.description}</p>}
      </div>
    );
  }

  // Number field
  if (type === 'number' || type === 'integer') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className="text-xs text-icon5">
          {name}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <Input
          id={name}
          type="number"
          value={String(value)}
          onChange={e => onChange(Number(e.target.value))}
          className="text-sm"
        />
        {property.description && <p className="text-[10px] text-icon3">{property.description}</p>}
      </div>
    );
  }

  // String field (default)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs text-icon5">
        {name}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <Input id={name} value={String(value)} onChange={e => onChange(e.target.value)} className="text-sm" />
      {property.description && <p className="text-[10px] text-icon3">{property.description}</p>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TestInputModal({ onRun, resumeSchema, isResume = false }: TestInputModalProps) {
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const showInputModal = useTestRunnerStore(state => state.showInputModal);
  const setShowInputModal = useTestRunnerStore(state => state.setShowInputModal);
  const testInput = useTestRunnerStore(state => state.testInput);
  const setTestInput = useTestRunnerStore(state => state.setTestInput);
  const isRunning = useTestRunnerStore(state => state.isRunning);

  // Use resume schema if provided, otherwise use workflow input schema
  const schema = resumeSchema || inputSchema;
  const properties = (schema?.properties as Record<string, SchemaProperty>) || {};
  const required = (schema?.required as string[]) || [];

  // Local form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  // Initialize form data from schema defaults and saved test input
  useEffect(() => {
    const initialData: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(properties)) {
      initialData[key] = testInput[key] !== undefined ? testInput[key] : getDefaultValue(prop);
    }
    setFormData(initialData);
  }, [properties, testInput]);

  const updateField = useCallback((name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate required fields
      for (const field of required) {
        const value = formData[field];
        if (value === undefined || value === null || value === '') {
          setError(`Field "${field}" is required`);
          return;
        }
      }

      // Save input for future runs
      setTestInput(formData);

      try {
        await onRun(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to run test');
      }
    },
    [formData, required, onRun, setTestInput],
  );

  const handleClose = useCallback(() => {
    setShowInputModal(false);
    setError(null);
  }, [setShowInputModal]);

  if (!showInputModal) return null;

  const hasFields = Object.keys(properties).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-surface1 border border-border1 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <div>
            <h2 className="text-sm font-semibold text-icon6">{isResume ? 'Provide Resume Input' : 'Test Workflow'}</h2>
            <p className="text-xs text-icon3 mt-0.5">
              {isResume ? 'Enter the required input to continue' : 'Enter test input values'}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 hover:bg-surface3 rounded">
            <X className="w-4 h-4 text-icon3" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {hasFields ? (
              Object.entries(properties).map(([name, prop]) => (
                <SchemaField
                  key={name}
                  name={name}
                  property={prop}
                  value={formData[name]}
                  onChange={value => updateField(name, value)}
                  required={required.includes(name)}
                />
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-icon4">No input required</p>
                <p className="text-xs text-icon3 mt-1">This workflow doesn't require any input values</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border1 bg-surface2">
            <Button type="button" variant="ghost" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default" size="md" disabled={isRunning}>
              {isRunning ? (
                'Running...'
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  {isResume ? 'Resume' : 'Run Test'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
