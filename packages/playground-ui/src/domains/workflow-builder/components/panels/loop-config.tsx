import { useMemo } from 'react';
import type { BuilderNode, LoopNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorSet } from '../../hooks/use-graph-utils';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

export interface LoopConfigProps {
  node: BuilderNode;
}

export function LoopConfig({ node }: LoopConfigProps) {
  const data = node.data as LoopNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // Use shared hook for predecessor calculation
  const predecessors = usePredecessorSet(node.id);

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

    // Add step outputs from predecessors only
    for (const n of nodes) {
      if (n.id === node.id || n.data.type === 'trigger') continue;
      if (!predecessors.has(n.id)) continue;
      refs.push({ path: `steps.${n.id}.output`, label: `${n.data.label}: Output` });
    }

    return refs;
  }, [nodes, node.id, inputSchema, predecessors]);

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <input
          type="text"
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Loop"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Loop Type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Loop Type</Label>
        <Select
          value={data.loopType}
          onValueChange={value => updateNodeData(node.id, { loopType: value as 'dowhile' | 'dountil' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dowhile">Do While (continue while true)</SelectItem>
            <SelectItem value="dountil">Do Until (continue until true)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-icon3">
          {data.loopType === 'dowhile'
            ? 'Loop continues while the condition is true'
            : 'Loop continues until the condition becomes true'}
        </p>
      </div>

      {/* Condition Field */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Condition Field</Label>
        <Select
          value={(data.condition as { field?: { $ref: string } })?.field?.$ref ?? ''}
          onValueChange={value =>
            updateNodeData(node.id, {
              condition: value
                ? {
                    type: 'compare',
                    field: { $ref: value },
                    operator: (data.condition as { operator?: string })?.operator ?? 'equals',
                  }
                : null,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select field to check..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                {ref.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Condition Operator */}
      {data.condition && (
        <div className="space-y-1.5">
          <Label className="text-xs text-icon5">Operator</Label>
          <Select
            value={(data.condition as { operator?: string }).operator ?? 'equals'}
            onValueChange={value =>
              updateNodeData(node.id, {
                condition: { ...data.condition!, operator: value },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals (==)</SelectItem>
              <SelectItem value="notEquals">Not Equals (!=)</SelectItem>
              <SelectItem value="gt">Greater Than (&gt;)</SelectItem>
              <SelectItem value="gte">Greater or Equal (&gt;=)</SelectItem>
              <SelectItem value="lt">Less Than (&lt;)</SelectItem>
              <SelectItem value="lte">Less or Equal (&lt;=)</SelectItem>
              <SelectItem value="isNull">Is Null/Empty</SelectItem>
              <SelectItem value="isNotNull">Is Not Null/Empty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Condition Value */}
      {data.condition &&
        !['isNull', 'isNotNull'].includes((data.condition as { operator?: string }).operator ?? '') && (
          <div className="space-y-1.5">
            <Label className="text-xs text-icon5">Compare To Value</Label>
            <input
              type="text"
              value={
                (data.condition as { value?: { $literal?: unknown } }).value?.$literal !== undefined
                  ? String((data.condition as { value?: { $literal?: unknown } }).value?.$literal)
                  : ''
              }
              onChange={e => {
                let value: unknown = e.target.value;
                if (e.target.value === 'true') value = true;
                else if (e.target.value === 'false') value = false;
                else if (!isNaN(Number(e.target.value)) && e.target.value !== '') value = Number(e.target.value);
                updateNodeData(node.id, {
                  condition: { ...data.condition!, value: { $literal: value } },
                });
              }}
              placeholder="Enter value..."
              className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
            />
          </div>
        )}

      {/* Max Iterations */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Max Iterations</Label>
        <input
          type="number"
          min={1}
          max={1000}
          value={data.maxIterations ?? 10}
          onChange={e => updateNodeData(node.id, { maxIterations: parseInt(e.target.value) || 10 })}
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
        <p className="text-[10px] text-icon3">Safety limit to prevent infinite loops</p>
      </div>

      {/* Info */}
      <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
        Connect the loop's output to the steps that should repeat. The loop body executes before checking the condition.
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
