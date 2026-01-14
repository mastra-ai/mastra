import { useMemo } from 'react';
import type { BuilderNode, ForeachNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorSet } from '../../hooks/use-graph-utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ForeachConfigProps {
  node: BuilderNode;
}

export function ForeachConfig({ node }: ForeachConfigProps) {
  const data = node.data as ForeachNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // Use shared hook for predecessor calculation
  const predecessors = usePredecessorSet(node.id);

  // Build available variable references for collections
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
          placeholder="For Each"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Collection */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Collection to Iterate</Label>
        <Select
          value={data.collection?.$ref ?? ''}
          onValueChange={value => updateNodeData(node.id, { collection: value ? { $ref: value } : null })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a collection..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                {ref.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-icon3">The array or collection to iterate over</p>
      </div>

      {/* Item Variable */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Item Variable Name</Label>
        <input
          type="text"
          value={data.itemVariable ?? 'item'}
          onChange={e => updateNodeData(node.id, { itemVariable: e.target.value || 'item' })}
          placeholder="item"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
        <p className="text-[10px] text-icon3">Variable name to access the current item in the loop body</p>
      </div>

      {/* Concurrency */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Concurrency</Label>
        <input
          type="number"
          min={1}
          max={100}
          value={data.concurrency ?? 1}
          onChange={e => updateNodeData(node.id, { concurrency: parseInt(e.target.value) || 1 })}
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
        <p className="text-[10px] text-icon3">
          {data.concurrency === 1
            ? 'Items processed sequentially (one at a time)'
            : `Up to ${data.concurrency} items processed in parallel`}
        </p>
      </div>

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        Inside the loop body, access the current item using:
        <code className="block mt-1 px-2 py-1 bg-surface3 rounded font-mono">
          steps.{node.id}.{data.itemVariable || 'item'}
        </code>
        <code className="block mt-1 px-2 py-1 bg-surface3 rounded font-mono">steps.{node.id}.index</code>
      </div>

      {/* Output Reference */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Output Reference</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4 mb-2">The foreach output is an array of all iteration results:</p>
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
          placeholder="Optional description..."
          rows={2}
          className="bg-surface1 text-icon6"
        />
      </div>
    </div>
  );
}
