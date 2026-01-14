import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BuilderNode, ParallelNodeData, ParallelBranch } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { cn } from '@/lib/utils';

export interface ParallelConfigProps {
  node: BuilderNode;
}

export function ParallelConfig({ node }: ParallelConfigProps) {
  const data = node.data as ParallelNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);

  const updateBranch = useCallback(
    (index: number, updates: Partial<ParallelBranch>) => {
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
      },
    ];
    updateNodeData(node.id, { branches: newBranches });
  }, [data.branches, node.id, updateNodeData]);

  const removeBranch = useCallback(
    (index: number) => {
      if (data.branches.length <= 2) return; // Minimum 2 branches
      const newBranches = data.branches.filter((_, i) => i !== index);
      updateNodeData(node.id, { branches: newBranches });
    },
    [data.branches, node.id, updateNodeData],
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
          placeholder="Parallel"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        All branches execute simultaneously. The parallel step completes when all branches finish. Connect each branch
        output handle to the first step of each parallel path.
      </div>

      {/* Branches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-icon5">Branches ({data.branches.length})</Label>
          <button
            type="button"
            onClick={addBranch}
            className="flex items-center gap-1 text-xs text-accent1 hover:text-accent1/80"
          >
            <Plus className="w-3 h-3" />
            Add Branch
          </button>
        </div>

        {data.branches.map((branch, index) => (
          <div key={branch.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface2 border border-border1">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#06b6d4' }}
              title={`Output handle ${index + 1}`}
            />
            <input
              type="text"
              value={branch.label}
              onChange={e => updateBranch(index, { label: e.target.value })}
              placeholder={`Branch ${index + 1}`}
              className="flex-1 h-7 px-2 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
            />
            {data.branches.length > 2 && (
              <button
                type="button"
                onClick={() => removeBranch(index)}
                className="p-1.5 text-icon4 hover:text-red-400 hover:bg-red-500/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Output Reference */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Output Reference</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4 mb-2">Each branch output is available at:</p>
          <div className="space-y-1">
            {data.branches.map((branch, index) => (
              <code key={branch.id} className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
                steps.{node.id}.output.{index}
              </code>
            ))}
          </div>
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
