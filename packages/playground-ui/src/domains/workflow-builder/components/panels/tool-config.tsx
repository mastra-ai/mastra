import { useMemo, useState, useEffect, useCallback } from 'react';
import type { BuilderNode, ToolNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorIds } from '../../hooks/use-graph-utils';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfigField, OutputReference, SectionHeader, type DataReference } from './shared';
import { Loader2, ChevronDown, ChevronRight, AlertCircle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export interface ToolConfigProps {
  node: BuilderNode;
}

export function ToolConfig({ node }: ToolConfigProps) {
  const data = node.data as ToolNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const { data: tools, isLoading } = useTools();
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // Use shared hook for predecessor calculation
  const predecessorStepIds = usePredecessorIds(node.id);
  const predecessorSet = useMemo(() => new Set(predecessorStepIds), [predecessorStepIds]);

  // Get state schema from store
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);

  // Build available variable references
  const availableRefs = useMemo(() => {
    const refs: DataReference[] = [];

    // Add workflow input fields (always available)
    if (inputSchema && typeof inputSchema === 'object') {
      const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const key of Object.keys(properties)) {
          refs.push({
            path: `input.${key}`,
            label: `input.${key}`,
            description: 'Workflow input',
            sourceType: 'input',
          });
        }
      }
    }

    // Add workflow state fields (if state schema is defined)
    if (stateSchema && typeof stateSchema === 'object') {
      const stateProperties = (stateSchema as { properties?: Record<string, unknown> }).properties;
      if (stateProperties) {
        for (const key of Object.keys(stateProperties)) {
          refs.push({
            path: `state.${key}`,
            label: `state.${key}`,
            description: 'Persists across suspend/resume',
            sourceType: 'state',
          });
        }
      }
    }

    // Add outputs from predecessor steps only
    for (const n of nodes) {
      if (n.id === node.id) continue;
      if (n.data.type === 'trigger') continue;
      if (!predecessorSet.has(n.id)) continue;

      // Add the full output reference
      refs.push({
        path: `steps.${n.id}.output`,
        label: `${n.data.label} output`,
        description: 'Full output object',
        sourceType: 'step',
      });

      // For agent steps, add common output fields
      if (n.data.type === 'agent') {
        refs.push({
          path: `steps.${n.id}.output.text`,
          label: `${n.data.label} text`,
          description: 'Agent response text',
          sourceType: 'step',
        });
      }
    }

    return refs;
  }, [nodes, node.id, inputSchema, stateSchema, predecessorSet]);

  const toolList = useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      id,
      name: tool.id,
      description: tool.description,
    }));
  }, [tools]);

  const selectedTool = useMemo(() => {
    if (!data.toolId || !tools) return null;
    return tools[data.toolId];
  }, [data.toolId, tools]);

  // Parse tool's input schema to get required fields
  const toolInputFields = useMemo(() => {
    if (!selectedTool?.inputSchema) return { required: [], optional: [], all: [] };

    try {
      const schema =
        typeof selectedTool.inputSchema === 'string' ? JSON.parse(selectedTool.inputSchema) : selectedTool.inputSchema;

      // Handle JSON schema format
      const jsonSchema = schema?.json || schema;
      const properties = jsonSchema?.properties || {};
      const required = jsonSchema?.required || [];

      const all = Object.keys(properties);
      const requiredFields = all.filter(k => required.includes(k));
      const optionalFields = all.filter(k => !required.includes(k));

      return { required: requiredFields, optional: optionalFields, all };
    } catch {
      return { required: [], optional: [], all: [] };
    }
  }, [selectedTool]);

  // Check which required fields are missing mappings
  const missingRequiredFields = useMemo(() => {
    return toolInputFields.required.filter(field => {
      const mapping = data.input[field];
      if (!mapping) return true;
      if ('$ref' in mapping && !mapping.$ref) return true;
      return false;
    });
  }, [toolInputFields.required, data.input]);

  // Auto-populate required fields when tool changes
  const handleToolChange = useCallback(
    (toolId: string | null) => {
      updateNodeData(node.id, { toolId });

      // If we have a new tool selected, auto-add required fields
      if (toolId && tools?.[toolId]) {
        const tool = tools[toolId];
        if (tool.inputSchema) {
          try {
            const schema = typeof tool.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool.inputSchema;

            const jsonSchema = schema?.json || schema;
            const properties = jsonSchema?.properties || {};
            const required = jsonSchema?.required || [];

            // Create input mappings for required fields that aren't already mapped
            const newInput = { ...data.input };
            for (const field of required) {
              if (!newInput[field]) {
                newInput[field] = { $ref: '' }; // Empty ref - user needs to fill in
              }
            }

            if (Object.keys(newInput).length !== Object.keys(data.input).length) {
              updateNodeData(node.id, { input: newInput });
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    },
    [node.id, tools, data.input, updateNodeData],
  );

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Tool Step"
        />
      </div>

      {/* Tool Selection */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Tool</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading tools...
          </div>
        ) : (
          <Select value={data.toolId ?? ''} onValueChange={value => handleToolChange(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a tool" />
            </SelectTrigger>
            <SelectContent>
              {toolList.map(tool => (
                <SelectItem key={tool.id} value={tool.id}>
                  <div>
                    <div>{tool.name}</div>
                    {tool.description && (
                      <div className="text-xs text-icon3 truncate max-w-[200px]">{tool.description}</div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tool Info */}
      {selectedTool && (
        <div className="p-3 bg-surface3 rounded-lg">
          <p className="text-xs text-icon5 font-medium">{selectedTool.id}</p>
          {selectedTool.description && <p className="text-xs text-icon3 mt-1">{selectedTool.description}</p>}
        </div>
      )}

      {/* Missing Required Fields Warning */}
      {missingRequiredFields.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-500 font-medium">Missing required inputs</p>
            <p className="text-xs text-amber-500/80 mt-1">Please map values for: {missingRequiredFields.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border1 my-4" />

      {/* Input Section */}
      <InputMappingSection
        label="Input Mapping"
        description="Map workflow data to tool inputs"
        data={data}
        nodeId={node.id}
        availableRefs={availableRefs}
        updateNodeData={updateNodeData}
        requiredFields={toolInputFields.required}
      />

      {/* Output Section */}
      <OutputSection nodeId={node.id} />

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
        />
      </div>
    </div>
  );
}

interface InputMappingSectionProps {
  label: string;
  description: string;
  data: ToolNodeData;
  nodeId: string;
  availableRefs: DataReference[];
  updateNodeData: (id: string, data: Partial<ToolNodeData>) => void;
  requiredFields?: string[];
}

function InputMappingSection({
  label,
  description,
  data,
  nodeId,
  availableRefs,
  updateNodeData,
  requiredFields = [],
}: InputMappingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newKey, setNewKey] = useState('');

  const handleAddMapping = () => {
    if (!newKey.trim()) return;
    const newInput = { ...data.input, [newKey.trim()]: { $ref: '' } };
    updateNodeData(nodeId, { input: newInput });
    setNewKey('');
  };

  const handleRemoveMapping = (key: string) => {
    const newInput = { ...data.input };
    delete newInput[key];
    updateNodeData(nodeId, { input: newInput });
  };

  const mappingCount = Object.keys(data.input).length;

  return (
    <div className="space-y-3">
      <SectionHeader
        title={label}
        icon={<ArrowDownToLine className="w-4 h-4" />}
        expanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        badge={mappingCount > 0 ? mappingCount : undefined}
      />

      {isExpanded && (
        <div className="pl-1 space-y-3">
          <p className="text-[10px] text-icon3">{description}</p>

          {/* Existing mappings */}
          {Object.entries(data.input).map(([key, value]) => {
            const isRequired = requiredFields.includes(key);
            const isRef = '$ref' in value;
            const hasValue = isRef ? !!value.$ref : '$literal' in value;
            const isInvalid = isRequired && !hasValue;

            return (
              <MappingField
                key={key}
                fieldKey={key}
                value={value}
                isRequired={isRequired}
                isInvalid={isInvalid}
                availableRefs={availableRefs}
                onUpdate={newValue => {
                  const newInput = { ...data.input, [key]: newValue };
                  updateNodeData(nodeId, { input: newInput });
                }}
                onRemove={!isRequired ? () => handleRemoveMapping(key) : undefined}
              />
            );
          })}

          {/* Add new mapping */}
          <div className="flex items-center gap-2">
            <Input
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Field name"
              className="h-8 text-xs flex-1"
            />
            <button
              type="button"
              onClick={handleAddMapping}
              disabled={!newKey.trim()}
              className="text-xs text-accent1 hover:text-accent1/80 disabled:opacity-50"
            >
              + Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface OutputSectionProps {
  nodeId: string;
}

interface MappingFieldProps {
  fieldKey: string;
  value: { $ref: string } | { $literal: unknown };
  isRequired: boolean;
  isInvalid: boolean;
  availableRefs: DataReference[];
  onUpdate: (value: { $ref: string } | { $literal: unknown }) => void;
  onRemove?: () => void;
}

function MappingField({
  fieldKey,
  value,
  isRequired,
  isInvalid,
  availableRefs,
  onUpdate,
  onRemove,
}: MappingFieldProps) {
  const isRef = '$ref' in value;
  const currentValue = isRef ? value.$ref : '$literal' in value ? String(value.$literal) : '';
  const [mode, setMode] = useState<'ref' | 'literal'>(isRef ? 'ref' : 'literal');

  // Sync mode when value changes externally
  useEffect(() => {
    setMode('$ref' in value ? 'ref' : 'literal');
  }, [value]);

  const handleModeChange = (newMode: 'ref' | 'literal') => {
    setMode(newMode);
    if (newMode === 'ref') {
      onUpdate({ $ref: '' });
    } else {
      onUpdate({ $literal: '' });
    }
  };

  const handleValueChange = (newValue: string) => {
    if (mode === 'ref') {
      onUpdate({ $ref: newValue });
    } else {
      // Try to parse as JSON for non-string literals
      try {
        const parsed = JSON.parse(newValue);
        onUpdate({ $literal: parsed });
      } catch {
        onUpdate({ $literal: newValue });
      }
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border ${isInvalid ? 'border-amber-500/50 bg-amber-500/5' : 'border-border1 bg-surface2'}`}
    >
      {/* Field header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-icon5">{fieldKey}</span>
          {isRequired && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded">required</span>
          )}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-icon3 hover:text-red-400">
            Remove
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => handleModeChange('ref')}
          className={`text-[10px] px-2 py-1 rounded ${mode === 'ref' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon3 hover:text-icon5'}`}
        >
          Reference
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('literal')}
          className={`text-[10px] px-2 py-1 rounded ${mode === 'literal' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon3 hover:text-icon5'}`}
        >
          Literal
        </button>
      </div>

      {/* Value input */}
      {mode === 'ref' ? (
        <Select value={currentValue} onValueChange={handleValueChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a reference..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                <div>
                  <div className="text-xs">{ref.label}</div>
                  {ref.description && <div className="text-[10px] text-icon3">{ref.description}</div>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={currentValue}
          onChange={e => handleValueChange(e.target.value)}
          placeholder="Enter a literal value..."
          className="h-8 text-xs"
        />
      )}

      {/* Show current value for debugging */}
      {currentValue && (
        <div className="mt-2 text-[10px] text-icon3 font-mono truncate">
          {mode === 'ref' ? `→ ${currentValue}` : `= "${currentValue}"`}
        </div>
      )}
    </div>
  );
}

function OutputSection({ nodeId }: OutputSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Output"
        icon={<ArrowUpFromLine className="w-4 h-4" />}
        expanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="pl-1">
          <OutputReference stepId={nodeId} paths={[{ path: 'output', description: 'Tool execution result' }]} />
          <p className="text-[10px] text-icon3 mt-3 pl-1">
            Use this reference in downstream steps to access the tool output.
          </p>
        </div>
      )}
    </div>
  );
}
