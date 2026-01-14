'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Label } from '@/ds/components/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import type { StepPaletteItem } from './step-palette';

export interface StepConfig {
  id: string;
  type: StepPaletteItem['type'];
  referenceId: string; // The agent/tool/workflow ID
  name: string;
  input: Record<string, { $ref: string } | { $literal: unknown }>;
  structuredOutput?: Record<string, unknown>;
}

export interface StepConfigPanelProps {
  step: StepConfig | null;
  availableRefs: Array<{ path: string; label: string; description?: string }>;
  onUpdate: (step: StepConfig) => void;
  onClose: () => void;
  className?: string;
}

export function StepConfigPanel({ step, availableRefs, onUpdate, onClose, className = '' }: StepConfigPanelProps) {
  if (!step) {
    return <div className={cn('p-4 text-center text-icon3', className)}>Select a step to configure</div>;
  }

  const handleInputChange = (key: string, value: string, isLiteral: boolean) => {
    const newInput = { ...step.input };
    if (isLiteral) {
      try {
        newInput[key] = { $literal: JSON.parse(value) };
      } catch {
        newInput[key] = { $literal: value };
      }
    } else {
      newInput[key] = { $ref: value };
    }
    onUpdate({ ...step, input: newInput });
  };

  return (
    <div className={cn('flex flex-col h-full bg-surface1', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border1">
        <div>
          <h3 className="font-semibold text-sm text-icon6">{step.name}</h3>
          <p className="text-xs text-icon3 capitalize">{step.type} step</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface3 transition-colors">
          <X className="h-4 w-4 text-icon3" />
        </button>
      </div>

      {/* Config form */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {step.type === 'agent' && (
            <AgentStepConfig step={step} availableRefs={availableRefs} onInputChange={handleInputChange} />
          )}

          {step.type === 'tool' && (
            <ToolStepConfig step={step} availableRefs={availableRefs} onInputChange={handleInputChange} />
          )}

          {step.type === 'workflow' && (
            <WorkflowStepConfig step={step} availableRefs={availableRefs} onInputChange={handleInputChange} />
          )}

          {step.type === 'transform' && (
            <TransformStepConfig step={step} availableRefs={availableRefs} onInputChange={handleInputChange} />
          )}

          {step.type === 'suspend' && <SuspendStepConfig step={step} onUpdate={onUpdate} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// Agent step configuration
interface AgentStepConfigProps {
  step: StepConfig;
  availableRefs: Array<{ path: string; label: string }>;
  onInputChange: (key: string, value: string, isLiteral: boolean) => void;
}

function AgentStepConfig({ step, availableRefs, onInputChange }: AgentStepConfigProps) {
  const promptRef = step.input.prompt && '$ref' in step.input.prompt ? step.input.prompt.$ref : '';

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="prompt-source" className="block text-sm font-medium mb-1.5 text-icon5">
          Prompt Source
        </Label>
        <Select value={promptRef} onValueChange={value => onInputChange('prompt', value, false)}>
          <SelectTrigger id="prompt-source" className="w-full">
            <SelectValue placeholder="Select a source..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                {ref.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-icon3 mt-1">Where to get the prompt text for this agent</p>
      </div>

      <div>
        <Label htmlFor="instructions-override" className="block text-sm font-medium mb-1.5 text-icon5">
          Instructions Override (optional)
        </Label>
        <textarea
          id="instructions-override"
          placeholder="Custom instructions for this step..."
          className="w-full px-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1 min-h-[80px]"
          onChange={e => {
            if (e.target.value) {
              onInputChange('instructions', e.target.value, true);
            }
          }}
        />
      </div>
    </div>
  );
}

// Tool step configuration
interface ToolStepConfigProps {
  step: StepConfig;
  availableRefs: Array<{ path: string; label: string }>;
  onInputChange: (key: string, value: string, isLiteral: boolean) => void;
}

function ToolStepConfig({ step }: ToolStepConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-icon3">
        Configure input mappings for the tool. Map each required input to a value from previous steps or workflow input.
      </p>

      {/* For now, show a generic JSON editor */}
      <div>
        <Label htmlFor="tool-input-mapping" className="block text-sm font-medium mb-1.5 text-icon5">
          Input Mapping (JSON)
        </Label>
        <textarea
          id="tool-input-mapping"
          defaultValue={JSON.stringify(step.input, null, 2)}
          placeholder='{ "field": { "$ref": "input.value" } }'
          className="w-full px-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1 min-h-[120px] font-mono"
          onChange={e => {
            try {
              JSON.parse(e.target.value);
              // Would need to update the entire input object
            } catch {
              // Invalid JSON
            }
          }}
        />
      </div>
    </div>
  );
}

// Workflow step configuration
interface WorkflowStepConfigProps {
  step: StepConfig;
  availableRefs: Array<{ path: string; label: string }>;
  onInputChange: (key: string, value: string, isLiteral: boolean) => void;
}

function WorkflowStepConfig({ step }: WorkflowStepConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-icon3">Configure input mappings for the nested workflow.</p>

      <div>
        <Label htmlFor="workflow-input-mapping" className="block text-sm font-medium mb-1.5 text-icon5">
          Input Mapping (JSON)
        </Label>
        <textarea
          id="workflow-input-mapping"
          defaultValue={JSON.stringify(step.input, null, 2)}
          placeholder='{ "field": { "$ref": "input.value" } }'
          className="w-full px-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1 min-h-[120px] font-mono"
        />
      </div>
    </div>
  );
}

// Transform step configuration
interface TransformStepConfigProps {
  step: StepConfig;
  availableRefs: Array<{ path: string; label: string }>;
  onInputChange: (key: string, value: string, isLiteral: boolean) => void;
}

function TransformStepConfig({ step }: TransformStepConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-icon3">
        Define output mappings to transform data. Map output fields to values from previous steps.
      </p>

      <div>
        <Label htmlFor="transform-output-mapping" className="block text-sm font-medium mb-1.5 text-icon5">
          Output Mapping (JSON)
        </Label>
        <textarea
          id="transform-output-mapping"
          defaultValue={JSON.stringify(step.input, null, 2)}
          placeholder='{ "result": { "$ref": "steps.prev.output.value" } }'
          className="w-full px-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1 min-h-[120px] font-mono"
        />
      </div>
    </div>
  );
}

// Suspend step configuration
interface SuspendStepConfigProps {
  step: StepConfig;
  onUpdate: (step: StepConfig) => void;
}

function SuspendStepConfig({ step, onUpdate }: SuspendStepConfigProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-icon3">Configure the schema for data expected when the workflow is resumed.</p>

      <div>
        <Label htmlFor="suspend-resume-schema" className="block text-sm font-medium mb-1.5 text-icon5">
          Resume Schema (JSON Schema)
        </Label>
        <textarea
          id="suspend-resume-schema"
          defaultValue={JSON.stringify(step.structuredOutput || { type: 'object', properties: {} }, null, 2)}
          placeholder='{ "type": "object", "properties": { "approved": { "type": "boolean" } } }'
          className="w-full px-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1 min-h-[120px] font-mono"
          onChange={e => {
            try {
              const schema = JSON.parse(e.target.value);
              onUpdate({ ...step, structuredOutput: schema });
            } catch {
              // Invalid JSON
            }
          }}
        />
      </div>
    </div>
  );
}
