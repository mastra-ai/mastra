import { useMemo, useState } from 'react';
import type { BuilderNode, SleepNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ConfigField, ConfigInfoBox } from './shared';

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

type DurationUnit = 'ms' | 's' | 'm' | 'h';

const DURATION_UNITS: Array<{ value: DurationUnit; label: string; multiplier: number }> = [
  { value: 'ms', label: 'Milliseconds', multiplier: 1 },
  { value: 's', label: 'Seconds', multiplier: 1000 },
  { value: 'm', label: 'Minutes', multiplier: 60 * 1000 },
  { value: 'h', label: 'Hours', multiplier: 60 * 60 * 1000 },
];

/**
 * Parse a duration string like "5s", "100ms", "2m", "1h" and convert to milliseconds.
 * Returns the parsed value or null if invalid.
 */
function parseDurationString(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (isNaN(value) || value < 0) return null;

  const unit = (match[2]?.toLowerCase() || 'ms') as DurationUnit;
  const unitConfig = DURATION_UNITS.find(u => u.value === unit);
  if (!unitConfig) return null;

  return Math.round(value * unitConfig.multiplier);
}

/**
 * Convert milliseconds to a human-readable duration with the best unit.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Get the best unit for a given millisecond value.
 */
function getBestUnit(ms: number): DurationUnit {
  if (ms >= 3600000 && ms % 3600000 === 0) return 'h';
  if (ms >= 60000 && ms % 60000 === 0) return 'm';
  if (ms >= 1000 && ms % 1000 === 0) return 's';
  return 'ms';
}

/**
 * Convert milliseconds to a value in the specified unit.
 */
function msToUnit(ms: number, unit: DurationUnit): number {
  const unitConfig = DURATION_UNITS.find(u => u.value === unit);
  if (!unitConfig) return ms;
  return ms / unitConfig.multiplier;
}

export function SleepConfig({ node }: SleepConfigProps) {
  const data = node.data as SleepNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  // State for custom duration input
  const currentDuration = data.duration ?? 1000;
  const initialUnit = getBestUnit(currentDuration);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialUnit);
  const [customInput, setCustomInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Check if current duration matches a preset
  const isPreset = DURATION_PRESETS.some(p => p.value === currentDuration);
  const [useCustom, setUseCustom] = useState(!isPreset);

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

  // Handle custom duration input with unit parsing
  const handleCustomInputChange = (value: string) => {
    setCustomInput(value);
    setInputError(null);

    // Try to parse the input
    const parsed = parseDurationString(value);
    if (parsed !== null) {
      updateNodeData(node.id, { duration: parsed });
    } else if (value.trim()) {
      // Only show error if there's non-empty input
      setInputError('Invalid format. Use: 5s, 100ms, 2m, or 1h');
    }
  };

  // Handle value input change (numeric with unit selector)
  const handleValueChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      const unitConfig = DURATION_UNITS.find(u => u.value === durationUnit);
      const msValue = Math.round(numValue * (unitConfig?.multiplier ?? 1));
      updateNodeData(node.id, { duration: msValue });
    }
  };

  // Handle unit change
  const handleUnitChange = (newUnit: DurationUnit) => {
    setDurationUnit(newUnit);
    // Keep the same millisecond value, just change display unit
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <ConfigField label="Label">
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Sleep"
        />
      </ConfigField>

      {/* Sleep Type */}
      <ConfigField label="Sleep Type">
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
      </ConfigField>

      {/* Duration */}
      {data.sleepType === 'duration' && (
        <>
          {/* Preset or Custom Toggle */}
          <ConfigField label="Duration Mode">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUseCustom(false)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  !useCustom
                    ? 'bg-accent1/20 border-accent1 text-accent1'
                    : 'bg-surface2 border-border1 text-icon4 hover:text-icon5 hover:border-border2'
                }`}
              >
                Preset
              </button>
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  useCustom
                    ? 'bg-accent1/20 border-accent1 text-accent1'
                    : 'bg-surface2 border-border1 text-icon4 hover:text-icon5 hover:border-border2'
                }`}
              >
                Custom
              </button>
            </div>
          </ConfigField>

          {!useCustom ? (
            // Preset selection
            <ConfigField label="Duration Preset">
              <Select
                value={DURATION_PRESETS.find(p => p.value === currentDuration)?.value.toString() ?? '1000'}
                onValueChange={value => {
                  updateNodeData(node.id, { duration: parseInt(value) });
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
                </SelectContent>
              </Select>
            </ConfigField>
          ) : (
            // Custom input
            <>
              {/* Duration value with unit selector */}
              <ConfigField
                label="Duration Value"
                hint={`Wait for ${formatDuration(currentDuration)} before continuing`}
              >
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={msToUnit(currentDuration, durationUnit)}
                    onChange={e => handleValueChange(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={durationUnit} onValueChange={value => handleUnitChange(value as DurationUnit)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_UNITS.map(unit => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ConfigField>

              {/* Quick input with auto-parsing */}
              <ConfigField
                label="Quick Input"
                hint="Type duration with unit (e.g., 5s, 100ms, 2m, 1h)"
                error={inputError ?? undefined}
              >
                <Input
                  type="text"
                  value={customInput}
                  onChange={e => handleCustomInputChange(e.target.value)}
                  placeholder="e.g., 30s, 5m, 1h"
                />
              </ConfigField>
            </>
          )}

          {/* Current value display */}
          <div className="px-3 py-2 bg-surface3 rounded-lg border border-border1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-icon4">Current value:</span>
              <span className="text-xs font-mono text-icon6">{formatDuration(currentDuration)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-icon3">Raw milliseconds:</span>
              <span className="text-[10px] font-mono text-icon4">{currentDuration}ms</span>
            </div>
          </div>
        </>
      )}

      {/* Timestamp */}
      {data.sleepType === 'timestamp' && (
        <ConfigField
          label="Timestamp Reference"
          hint="Wait until the referenced timestamp is reached (ISO 8601 or Unix ms)"
        >
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
        </ConfigField>
      )}

      {/* Info */}
      <ConfigInfoBox>
        Sleep steps pause workflow execution for a specified duration or until a specific time. This is useful for rate
        limiting, scheduling, or waiting for external events.
      </ConfigInfoBox>

      {/* Description */}
      <ConfigField label="Description">
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
        />
      </ConfigField>
    </div>
  );
}
