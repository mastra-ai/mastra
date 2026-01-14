import { useMemo } from 'react';
import type { BuilderNode, SleepNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SleepConfigProps {
  node: BuilderNode;
}

// Duration presets in milliseconds
const DURATION_PRESETS = [
  { value: 1000, label: '1 second' },
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '1 hour' },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function SleepConfig({ node }: SleepConfigProps) {
  const data = node.data as SleepNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // Build available variable references for timestamp
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
    }

    return refs;
  }, [nodes, node.id, inputSchema]);

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <input
          type="text"
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Sleep"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Sleep Type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Sleep Type</Label>
        <Select
          value={data.sleepType}
          onValueChange={value => updateNodeData(node.id, { sleepType: value as 'duration' | 'timestamp' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="duration">Fixed Duration</SelectItem>
            <SelectItem value="timestamp">Until Timestamp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Duration */}
      {data.sleepType === 'duration' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-icon5">Duration Preset</Label>
            <Select
              value={DURATION_PRESETS.find(p => p.value === data.duration)?.value.toString() ?? 'custom'}
              onValueChange={value => {
                if (value !== 'custom') {
                  updateNodeData(node.id, { duration: parseInt(value) });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duration..." />
              </SelectTrigger>
              <SelectContent>
                {DURATION_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value.toString()}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-icon5">Duration (milliseconds)</Label>
            <input
              type="number"
              min={0}
              value={data.duration ?? 1000}
              onChange={e => updateNodeData(node.id, { duration: parseInt(e.target.value) || 1000 })}
              className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
            />
            <p className="text-[10px] text-icon3">Wait for {formatDuration(data.duration ?? 1000)} before continuing</p>
          </div>
        </>
      )}

      {/* Timestamp */}
      {data.sleepType === 'timestamp' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-icon5">Timestamp Reference</Label>
          <Select
            value={(data.timestamp as { $ref?: string })?.$ref ?? ''}
            onValueChange={value => updateNodeData(node.id, { timestamp: value ? { $ref: value } : undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timestamp source..." />
            </SelectTrigger>
            <SelectContent>
              {availableRefs.map(ref => (
                <SelectItem key={ref.path} value={ref.path}>
                  {ref.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-icon3">Wait until the referenced timestamp is reached (ISO 8601 or Unix ms)</p>
        </div>
      )}

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        Sleep steps pause workflow execution for a specified duration or until a specific time. This is useful for rate
        limiting, scheduling, or waiting for external events.
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
