import { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BuilderNode, SuspendNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SuspendConfigProps {
  node: BuilderNode;
}

type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface SchemaProperty {
  type: SchemaPropertyType;
  description?: string;
}

export function SuspendConfig({ node }: SuspendConfigProps) {
  const data = node.data as SuspendNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);

  const schemaProperties = (data.resumeSchema?.properties as Record<string, SchemaProperty>) || {};
  const requiredFields = (data.resumeSchema?.required as string[]) || [];

  const [newFieldName, setNewFieldName] = useState('');

  const addField = useCallback(() => {
    if (!newFieldName.trim()) return;
    const newProperties = {
      ...schemaProperties,
      [newFieldName.trim()]: { type: 'string' as const, description: '' },
    };
    updateNodeData(node.id, {
      resumeSchema: { ...data.resumeSchema, type: 'object', properties: newProperties },
    });
    setNewFieldName('');
  }, [newFieldName, schemaProperties, data.resumeSchema, node.id, updateNodeData]);

  const removeField = useCallback(
    (key: string) => {
      const newProperties = { ...schemaProperties };
      delete newProperties[key];
      const newRequired = requiredFields.filter(f => f !== key);
      updateNodeData(node.id, {
        resumeSchema: { ...data.resumeSchema, properties: newProperties, required: newRequired },
      });
    },
    [schemaProperties, requiredFields, data.resumeSchema, node.id, updateNodeData],
  );

  const updateField = useCallback(
    (key: string, updates: Partial<SchemaProperty>) => {
      const newProperties = {
        ...schemaProperties,
        [key]: { ...schemaProperties[key], ...updates },
      };
      updateNodeData(node.id, {
        resumeSchema: { ...data.resumeSchema, properties: newProperties },
      });
    },
    [schemaProperties, data.resumeSchema, node.id, updateNodeData],
  );

  const toggleRequired = useCallback(
    (key: string) => {
      const newRequired = requiredFields.includes(key)
        ? requiredFields.filter(f => f !== key)
        : [...requiredFields, key];
      updateNodeData(node.id, {
        resumeSchema: { ...data.resumeSchema, required: newRequired },
      });
    },
    [requiredFields, data.resumeSchema, node.id, updateNodeData],
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
          placeholder="Human Input"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
        This step pauses the workflow and waits for human input. Define the fields that humans need to provide to
        continue execution.
      </div>

      {/* Resume Schema Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-icon5">Input Fields</Label>
          <span className="text-[10px] text-icon3">{Object.keys(schemaProperties).length} fields</span>
        </div>

        {Object.entries(schemaProperties).map(([key, prop]) => (
          <div key={key} className="p-3 rounded-lg bg-surface2 border border-border1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-icon6">{key}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleRequired(key)}
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    requiredFields.includes(key) ? 'bg-red-500/20 text-red-400' : 'bg-surface3 text-icon4'
                  }`}
                >
                  {requiredFields.includes(key) ? 'Required' : 'Optional'}
                </button>
                <button
                  type="button"
                  onClick={() => removeField(key)}
                  className="p-1 text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-icon4">Type</label>
                <Select
                  value={prop.type}
                  onValueChange={value => updateField(key, { type: value as SchemaPropertyType })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-icon4">Description</label>
                <input
                  type="text"
                  value={prop.description ?? ''}
                  onChange={e => updateField(key, { description: e.target.value })}
                  placeholder="Field description..."
                  className="w-full h-7 px-2 text-xs rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
                />
              </div>
            </div>
          </div>
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
          <p className="text-xs text-icon4 mb-2">Human-provided data will be available at:</p>
          <code className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
            steps.{node.id}.output
          </code>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Instructions for the human reviewer..."
          rows={2}
          className="bg-surface1 text-icon6"
        />
      </div>
    </div>
  );
}
