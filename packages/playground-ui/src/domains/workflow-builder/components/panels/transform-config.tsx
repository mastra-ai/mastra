import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BuilderNode, TransformNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import type { ValueOrRef } from '../../types';

export interface TransformConfigProps {
  node: BuilderNode;
}

export function TransformConfig({ node }: TransformConfigProps) {
  const data = node.data as TransformNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // Build available variable references
  const availableRefs = useMemo(() => {
    const refs: Array<{ path: string; label: string }> = [];

    // Add input schema fields
    if (inputSchema && typeof inputSchema === 'object') {
      const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const key of Object.keys(properties)) {
          refs.push({ path: `input.${key}`, label: `Workflow Input: ${key}` });
        }
      }
    }

    // Add step outputs
    for (const n of nodes) {
      if (n.id === node.id || n.data.type === 'trigger') continue;
      refs.push({ path: `steps.${n.id}.output`, label: `${n.data.label}: Output` });
      if (n.data.type === 'agent') {
        refs.push({ path: `steps.${n.id}.output.text`, label: `${n.data.label}: text` });
      }
    }

    return refs;
  }, [nodes, node.id, inputSchema]);

  const [newFieldName, setNewFieldName] = useState('');

  const outputEntries = Object.entries(data.output || {});

  const addField = useCallback(() => {
    if (!newFieldName.trim()) return;
    const newOutput = { ...data.output, [newFieldName.trim()]: { $literal: '' } };
    updateNodeData(node.id, { output: newOutput });
    setNewFieldName('');
  }, [newFieldName, data.output, node.id, updateNodeData]);

  const removeField = useCallback(
    (key: string) => {
      const newOutput = { ...data.output };
      delete newOutput[key];
      updateNodeData(node.id, { output: newOutput });
    },
    [data.output, node.id, updateNodeData],
  );

  const updateField = useCallback(
    (key: string, value: ValueOrRef) => {
      const newOutput = { ...data.output, [key]: value };
      updateNodeData(node.id, { output: newOutput });
    },
    [data.output, node.id, updateNodeData],
  );

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <input
          type="text"
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Transform"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        Transform steps let you map and reshape data. Define output fields and their values using references to previous
        steps or literal values.
      </div>

      {/* Output Fields */}
      <div className="space-y-3">
        <Label className="text-xs text-icon5">Output Fields</Label>

        {outputEntries.map(([key, value]) => (
          <OutputFieldEditor
            key={key}
            fieldName={key}
            value={value}
            availableRefs={availableRefs}
            onChange={newValue => updateField(key, newValue)}
            onRemove={() => removeField(key)}
          />
        ))}

        {/* Add new field */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addField()}
            placeholder="New field name..."
            className="flex-1 h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
          />
          <button
            type="button"
            onClick={addField}
            disabled={!newFieldName.trim()}
            className="flex items-center gap-1 px-3 h-8 text-xs text-accent1 hover:text-accent1/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* Output Reference */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Output Reference</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4 mb-2">Access transformed data at:</p>
          <code className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
            steps.{node.id}.output
          </code>
          {outputEntries.length > 0 && (
            <div className="mt-2 space-y-1">
              {outputEntries.map(([key]) => (
                <code key={key} className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
                  steps.{node.id}.output.{key}
                </code>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
          className="bg-surface1 text-icon6"
        />
      </div>
    </div>
  );
}

interface OutputFieldEditorProps {
  fieldName: string;
  value: ValueOrRef;
  availableRefs: Array<{ path: string; label: string }>;
  onChange: (value: ValueOrRef) => void;
  onRemove: () => void;
}

function OutputFieldEditor({ fieldName, value, availableRefs, onChange, onRemove }: OutputFieldEditorProps) {
  const isRef = value && typeof value === 'object' && '$ref' in value;
  const [mode, setMode] = useState<'ref' | 'literal'>(isRef ? 'ref' : 'literal');

  return (
    <div className="p-3 rounded-lg bg-surface2 border border-border1 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-icon6">{fieldName}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('ref');
              onChange({ $ref: '' });
            }}
            className={`text-[10px] px-2 py-0.5 rounded ${mode === 'ref' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon4'}`}
          >
            Reference
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('literal');
              onChange({ $literal: '' });
            }}
            className={`text-[10px] px-2 py-0.5 rounded ${mode === 'literal' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon4'}`}
          >
            Value
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {mode === 'ref' ? (
        <Select value={isRef ? (value as { $ref: string }).$ref : ''} onValueChange={v => onChange({ $ref: v })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select reference..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                {ref.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <input
          type="text"
          value={!isRef && value && typeof value === 'object' && '$literal' in value ? String(value.$literal) : ''}
          onChange={e => {
            let v: unknown = e.target.value;
            if (e.target.value === 'true') v = true;
            else if (e.target.value === 'false') v = false;
            else if (!isNaN(Number(e.target.value)) && e.target.value !== '') v = Number(e.target.value);
            onChange({ $literal: v });
          }}
          placeholder="Enter value..."
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      )}
    </div>
  );
}
