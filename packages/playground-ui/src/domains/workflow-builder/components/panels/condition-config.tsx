import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { BuilderNode, ConditionNodeData, ConditionBranch } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorSet } from '../../hooks/use-graph-utils';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'in'
  | 'isNull'
  | 'isNotNull';

type LogicalType = 'compare' | 'and' | 'or' | 'not';

interface CompareCondition {
  type: 'compare';
  field: { $ref: string };
  operator: ConditionOperator;
  value?: { $ref: string } | { $literal: unknown };
}

interface AndCondition {
  type: 'and';
  conditions: ConditionDef[];
}

interface OrCondition {
  type: 'or';
  conditions: ConditionDef[];
}

interface NotCondition {
  type: 'not';
  condition: ConditionDef;
}

type ConditionDef = CompareCondition | AndCondition | OrCondition | NotCondition;

// ============================================================================
// Constants
// ============================================================================

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'equals', label: '= equals', needsValue: true },
  { value: 'notEquals', label: '!= not equals', needsValue: true },
  { value: 'gt', label: '> greater than', needsValue: true },
  { value: 'gte', label: '>= greater or equal', needsValue: true },
  { value: 'lt', label: '< less than', needsValue: true },
  { value: 'lte', label: '<= less or equal', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'startsWith', label: 'starts with', needsValue: true },
  { value: 'endsWith', label: 'ends with', needsValue: true },
  { value: 'matches', label: 'matches regex', needsValue: true },
  { value: 'in', label: 'in array', needsValue: true },
  { value: 'isNull', label: 'is null/empty', needsValue: false },
  { value: 'isNotNull', label: 'is not null/empty', needsValue: false },
];

// Inline styles for inputs
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
// Props
// ============================================================================

export interface ConditionConfigProps {
  node: BuilderNode;
}

// ============================================================================
// Helper: Available References
// ============================================================================

function useAvailableRefs(nodeId: string) {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);

  // Use shared hook for predecessor calculation
  const predecessors = usePredecessorSet(nodeId);

  return useMemo(() => {
    const refs: Array<{ path: string; label: string; group: string }> = [];

    // Workflow input fields
    if (inputSchema && typeof inputSchema === 'object') {
      const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const key of Object.keys(properties)) {
          refs.push({
            path: `input.${key}`,
            label: key,
            group: 'Workflow Input',
          });
        }
      }
    }

    // Workflow state fields
    if (stateSchema && typeof stateSchema === 'object') {
      const stateProperties = (stateSchema as { properties?: Record<string, unknown> }).properties;
      if (stateProperties) {
        for (const key of Object.keys(stateProperties)) {
          refs.push({
            path: `state.${key}`,
            label: key,
            group: 'Workflow State',
          });
        }
      }
    }

    // Step outputs from predecessors
    for (const n of nodes) {
      if (n.id === nodeId) continue;
      if (n.data.type === 'trigger') continue;
      if (!predecessors.has(n.id)) continue;

      refs.push({
        path: `steps.${n.id}.output`,
        label: `${n.data.label} (full output)`,
        group: 'Step Outputs',
      });

      if (n.data.type === 'agent') {
        refs.push({
          path: `steps.${n.id}.output.text`,
          label: `${n.data.label}.text`,
          group: 'Step Outputs',
        });
      }
    }

    return refs;
  }, [nodeId, nodes, inputSchema, stateSchema, predecessors]);
}

// ============================================================================
// Condition Builder Component
// ============================================================================

interface ConditionBuilderProps {
  condition: ConditionDef | null;
  onChange: (condition: ConditionDef | null) => void;
  availableRefs: Array<{ path: string; label: string; group: string }>;
  depth?: number;
}

function ConditionBuilder({ condition, onChange, availableRefs, depth = 0 }: ConditionBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Default to compare condition
  const conditionType: LogicalType = condition?.type || 'compare';

  const handleTypeChange = (type: LogicalType) => {
    switch (type) {
      case 'compare':
        onChange({ type: 'compare', field: { $ref: '' }, operator: 'equals' });
        break;
      case 'and':
        onChange({ type: 'and', conditions: [{ type: 'compare', field: { $ref: '' }, operator: 'equals' }] });
        break;
      case 'or':
        onChange({ type: 'or', conditions: [{ type: 'compare', field: { $ref: '' }, operator: 'equals' }] });
        break;
      case 'not':
        onChange({ type: 'not', condition: { type: 'compare', field: { $ref: '' }, operator: 'equals' } });
        break;
    }
  };

  if (!condition) {
    return (
      <div className="p-3 border border-dashed border-border1 rounded-md text-center">
        <p className="text-xs text-icon4 mb-2">No condition defined</p>
        <button
          type="button"
          onClick={() => onChange({ type: 'compare', field: { $ref: '' }, operator: 'equals' })}
          className="text-xs text-accent1 hover:text-accent1/80"
        >
          + Add condition
        </button>
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border border-border1 bg-surface1', depth > 0 && 'mt-2')}>
      <div className="p-3 space-y-3">
        {/* Condition type selector */}
        <div className="flex items-center gap-2">
          <select
            value={conditionType}
            onChange={e => handleTypeChange(e.target.value as LogicalType)}
            style={selectStyle}
            className="h-7 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer"
          >
            <option value="compare">Compare</option>
            <option value="and">AND (all)</option>
            <option value="or">OR (any)</option>
            <option value="not">NOT</option>
          </select>

          {(conditionType === 'and' || conditionType === 'or') && (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-surface3 rounded">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-icon4" />
              ) : (
                <ChevronRight className="w-4 h-4 text-icon4" />
              )}
            </button>
          )}

          <div className="flex-1" />

          {depth > 0 && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="p-1 text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Compare condition */}
        {condition.type === 'compare' && (
          <CompareConditionEditor condition={condition} onChange={onChange} availableRefs={availableRefs} />
        )}

        {/* AND/OR conditions */}
        {(condition.type === 'and' || condition.type === 'or') && isExpanded && (
          <div className="space-y-2 ml-4">
            <p className="text-[10px] text-icon3">
              {condition.type === 'and' ? 'All conditions must be true' : 'At least one condition must be true'}
            </p>
            {condition.conditions.map((subCondition, index) => (
              <ConditionBuilder
                key={index}
                condition={subCondition}
                onChange={updated => {
                  const newConditions = [...condition.conditions];
                  if (updated) {
                    newConditions[index] = updated;
                  } else {
                    newConditions.splice(index, 1);
                  }
                  if (newConditions.length === 0) {
                    onChange(null);
                  } else {
                    onChange({ ...condition, conditions: newConditions });
                  }
                }}
                availableRefs={availableRefs}
                depth={depth + 1}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                const newConditions = [
                  ...condition.conditions,
                  { type: 'compare' as const, field: { $ref: '' }, operator: 'equals' as const },
                ];
                onChange({ ...condition, conditions: newConditions });
              }}
              className="flex items-center gap-1 text-xs text-accent1 hover:text-accent1/80 py-1"
            >
              <Plus className="w-3 h-3" />
              Add condition
            </button>
          </div>
        )}

        {/* NOT condition */}
        {condition.type === 'not' && (
          <div className="ml-4">
            <p className="text-[10px] text-icon3 mb-2">Negates the following condition</p>
            <ConditionBuilder
              condition={condition.condition}
              onChange={updated => {
                if (updated) {
                  onChange({ type: 'not', condition: updated });
                } else {
                  onChange(null);
                }
              }}
              availableRefs={availableRefs}
              depth={depth + 1}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compare Condition Editor
// ============================================================================

interface CompareConditionEditorProps {
  condition: CompareCondition;
  onChange: (condition: ConditionDef) => void;
  availableRefs: Array<{ path: string; label: string; group: string }>;
}

function CompareConditionEditor({ condition, onChange, availableRefs }: CompareConditionEditorProps) {
  const [valueMode, setValueMode] = useState<'ref' | 'literal'>(
    condition.value && '$ref' in condition.value ? 'ref' : 'literal',
  );

  const operator = OPERATORS.find(op => op.value === condition.operator);
  const needsValue = operator?.needsValue ?? true;

  // Group refs by category
  const groupedRefs = useMemo(() => {
    const groups: Record<string, Array<{ path: string; label: string }>> = {};
    for (const ref of availableRefs) {
      if (!groups[ref.group]) {
        groups[ref.group] = [];
      }
      groups[ref.group].push({ path: ref.path, label: ref.label });
    }
    return groups;
  }, [availableRefs]);

  return (
    <div className="space-y-2">
      {/* Field selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-icon4">Field to check</label>
        <select
          value={condition.field.$ref}
          onChange={e => onChange({ ...condition, field: { $ref: e.target.value } })}
          style={selectStyle}
          className="w-full h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer"
        >
          <option value="">Select a field...</option>
          {Object.entries(groupedRefs).map(([group, refs]) => (
            <optgroup key={group} label={group}>
              {refs.map(ref => (
                <option key={ref.path} value={ref.path}>
                  {ref.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Operator selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-icon4">Operator</label>
        <select
          value={condition.operator}
          onChange={e => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
          style={selectStyle}
          className="w-full h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer"
        >
          {OPERATORS.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input */}
      {needsValue && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-icon4">Compare to</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setValueMode('ref');
                  onChange({ ...condition, value: { $ref: '' } });
                }}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded',
                  valueMode === 'ref' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon4',
                )}
              >
                Reference
              </button>
              <button
                type="button"
                onClick={() => {
                  setValueMode('literal');
                  onChange({ ...condition, value: { $literal: '' } });
                }}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded',
                  valueMode === 'literal' ? 'bg-accent1/20 text-accent1' : 'bg-surface3 text-icon4',
                )}
              >
                Value
              </button>
            </div>
          </div>

          {valueMode === 'ref' ? (
            <select
              value={condition.value && '$ref' in condition.value ? condition.value.$ref : ''}
              onChange={e => onChange({ ...condition, value: { $ref: e.target.value } })}
              style={selectStyle}
              className="w-full h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1 cursor-pointer"
            >
              <option value="">Select a reference...</option>
              {Object.entries(groupedRefs).map(([group, refs]) => (
                <optgroup key={group} label={group}>
                  {refs.map(ref => (
                    <option key={ref.path} value={ref.path}>
                      {ref.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={condition.value && '$literal' in condition.value ? String(condition.value.$literal) : ''}
              onChange={e => {
                // Try to parse as number or boolean
                let value: unknown = e.target.value;
                if (e.target.value === 'true') value = true;
                else if (e.target.value === 'false') value = false;
                else if (!isNaN(Number(e.target.value)) && e.target.value !== '') value = Number(e.target.value);
                onChange({ ...condition, value: { $literal: value } });
              }}
              placeholder="Enter value (string, number, or boolean)"
              style={inputStyle}
              className="w-full h-8 px-2 text-xs rounded border focus:outline-none focus:border-accent1"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConditionConfig({ node }: ConditionConfigProps) {
  const data = node.data as ConditionNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const availableRefs = useAvailableRefs(node.id);

  const updateBranch = useCallback(
    (index: number, updates: Partial<ConditionBranch>) => {
      const newBranches = [...data.branches];
      newBranches[index] = { ...newBranches[index], ...updates };
      updateNodeData(node.id, { branches: newBranches });
    },
    [data.branches, node.id, updateNodeData],
  );

  const addBranch = useCallback(() => {
    const newBranches = [
      ...data.branches,
      {
        id: `branch-${Date.now()}`,
        label: `Branch ${data.branches.length + 1}`,
        condition: null,
      },
    ];
    updateNodeData(node.id, { branches: newBranches });
  }, [data.branches, node.id, updateNodeData]);

  const removeBranch = useCallback(
    (index: number) => {
      if (data.branches.length <= 1) return;
      const newBranches = data.branches.filter((_, i) => i !== index);
      updateNodeData(node.id, { branches: newBranches });
    },
    [data.branches, node.id, updateNodeData],
  );

  const toggleDefaultBranch = useCallback(
    (branchId: string) => {
      updateNodeData(node.id, {
        defaultBranch: data.defaultBranch === branchId ? undefined : branchId,
      });
    },
    [data.defaultBranch, node.id, updateNodeData],
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
          placeholder="Condition"
          style={inputStyle}
          className="w-full h-8 px-3 text-sm rounded border focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        Each branch defines a condition. The first branch whose condition is true will be executed. You can mark one
        branch as the default (else) which runs if no conditions match.
      </div>

      {/* Branches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-icon5">Branches</Label>
          <button
            type="button"
            onClick={addBranch}
            className="flex items-center gap-1 text-xs text-accent1 hover:text-accent1/80"
          >
            <Plus className="w-3 h-3" />
            Add Branch
          </button>
        </div>

        {data.branches.map((branch, index) => {
          const isDefault = data.defaultBranch === branch.id;

          return (
            <div
              key={branch.id}
              className={cn(
                'p-3 rounded-lg space-y-3 border',
                isDefault ? 'bg-accent1/5 border-accent1/30' : 'bg-surface2 border-border1',
              )}
            >
              {/* Branch header */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={branch.label}
                  onChange={e => updateBranch(index, { label: e.target.value })}
                  placeholder={`Branch ${index + 1}`}
                  style={inputStyle}
                  className="flex-1 h-7 px-2 text-sm rounded border focus:outline-none focus:border-accent1"
                />

                <button
                  type="button"
                  onClick={() => toggleDefaultBranch(branch.id)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded border transition-colors',
                    isDefault
                      ? 'bg-accent1/20 text-accent1 border-accent1/30'
                      : 'bg-surface3 text-icon4 border-border1 hover:border-icon3',
                  )}
                >
                  {isDefault ? 'Default' : 'Set as Default'}
                </button>

                {data.branches.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBranch(index)}
                    className="p-1.5 text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Condition (not shown for default branch) */}
              {!isDefault && (
                <div className="space-y-1">
                  <label className="text-[10px] text-icon4">Condition</label>
                  <ConditionBuilder
                    condition={branch.condition as ConditionDef | null}
                    onChange={condition => updateBranch(index, { condition })}
                    availableRefs={availableRefs}
                  />
                </div>
              )}

              {isDefault && (
                <p className="text-[10px] text-icon3">This branch runs if no other conditions match (else branch)</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
          style={{ color: '#E6E6E6', backgroundColor: '#0F0F0F' }}
        />
      </div>
    </div>
  );
}
