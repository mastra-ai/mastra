'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { SchemaField } from './schema-settings/schema-field';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useWorkflowSchema } from '../hooks/use-workflow-schema';
import { useAgentSchema } from '../hooks/use-agent-schema';
import { useScorerSchema } from '../hooks/use-scorer-schema';
import type { JSONSchema7 } from 'json-schema';

type SourceType = 'custom' | 'agent' | 'workflow' | 'scorer';
type ScorerTargetType = 'agent' | 'custom';

interface SchemaConfigSectionProps {
  inputSchema: Record<string, unknown> | null | undefined;
  outputSchema: Record<string, unknown> | null | undefined;
  onChange: (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
  }) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

/**
 * Collapsible section for configuring dataset schemas.
 * Supports source-based auto-population from Agent, Workflow, or Scorer schemas.
 */
export function SchemaConfigSection({
  inputSchema,
  outputSchema,
  onChange,
  disabled = false,
  defaultOpen = false,
}: SchemaConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [sourceType, setSourceType] = useState<SourceType>('custom');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [scorerTargetType, setScorerTargetType] = useState<ScorerTargetType>('agent');

  // Fetch workflows for workflow source selection
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const workflowOptions = workflows ? Object.entries(workflows) : [];

  // Fetch workflow schema when workflow selected
  const { data: workflowSchema, isLoading: workflowSchemaLoading } = useWorkflowSchema(
    sourceType === 'workflow' ? selectedWorkflow : null,
  );

  // Static schemas for agent and scorer
  const agentSchema = useAgentSchema();
  const scorerSchema = useScorerSchema();

  // Get source schemas based on source type
  const getSourceSchemas = (): { inputSchema: JSONSchema7 | null; outputSchema: JSONSchema7 | null } => {
    switch (sourceType) {
      case 'agent':
        return {
          inputSchema: agentSchema.inputSchema,
          outputSchema: agentSchema.outputSchema,
        };
      case 'workflow':
        if (!workflowSchema) return { inputSchema: null, outputSchema: null };
        return {
          inputSchema: (workflowSchema.inputSchema as JSONSchema7) ?? null,
          outputSchema: (workflowSchema.outputSchema as JSONSchema7) ?? null,
        };
      case 'scorer':
        return {
          inputSchema: scorerTargetType === 'agent' ? scorerSchema.agentInputSchema : scorerSchema.customInputSchema,
          outputSchema: scorerSchema.outputSchema,
        };
      default:
        return { inputSchema: null, outputSchema: null };
    }
  };

  const sourceSchemas = getSourceSchemas();
  // Auto-populate when not custom (scorer always auto-populates with agent or custom schema)
  const isAutoPopulate = sourceType !== 'custom';

  // Track previous source key to detect source changes
  const prevSourceKeyRef = useRef<string | null>(null);

  // Auto-populate when source changes
  // - When source/workflow changes: re-populate all ENABLED schemas (even if not empty)
  // - When toggling on a schema: populate if empty (handled by SchemaField)
  useEffect(() => {
    if (sourceType === 'custom') return;
    if (!sourceSchemas.inputSchema && !sourceSchemas.outputSchema) return;

    // Create a key representing the current source selection
    const currentSourceKey =
      sourceType === 'workflow'
        ? `workflow:${selectedWorkflow}`
        : sourceType === 'scorer'
          ? `scorer:${scorerTargetType}`
          : sourceType;

    // Check if source changed (not just initial render)
    const sourceChanged = prevSourceKeyRef.current !== null && prevSourceKeyRef.current !== currentSourceKey;
    prevSourceKeyRef.current = currentSourceKey;

    // For workflow, also need to wait for schema to load
    if (sourceType === 'workflow' && !workflowSchema) return;

    const isInputEnabled = inputSchema !== null && inputSchema !== undefined;
    const isOutputEnabled = outputSchema !== null && outputSchema !== undefined;

    // Check if schemas are empty (for initial population when toggling on)
    const isInputEmpty =
      inputSchema && inputSchema.type === 'object' && Object.keys(inputSchema.properties || {}).length === 0;
    const isOutputEmpty =
      outputSchema && outputSchema.type === 'object' && Object.keys(outputSchema.properties || {}).length === 0;

    // Populate if: source changed and schema is enabled, OR schema is enabled but empty
    const shouldPopulateInput = sourceSchemas.inputSchema && isInputEnabled && (sourceChanged || isInputEmpty);
    const shouldPopulateOutput = sourceSchemas.outputSchema && isOutputEnabled && (sourceChanged || isOutputEmpty);

    if (shouldPopulateInput || shouldPopulateOutput) {
      onChange({
        inputSchema: shouldPopulateInput
          ? (sourceSchemas.inputSchema as Record<string, unknown>)
          : (inputSchema ?? null),
        outputSchema: shouldPopulateOutput
          ? (sourceSchemas.outputSchema as Record<string, unknown>)
          : (outputSchema ?? null),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, selectedWorkflow, workflowSchema, scorerTargetType]);

  const handleInputSchemaChange = (schema: Record<string, unknown> | null) => {
    onChange({ inputSchema: schema, outputSchema: outputSchema ?? null });
  };

  const handleOutputSchemaChange = (schema: Record<string, unknown> | null) => {
    onChange({ inputSchema: inputSchema ?? null, outputSchema: schema });
  };

  const handleSourceChange = (value: SourceType) => {
    setSourceType(value);
    // Reset workflow selection when switching away from workflow
    if (value !== 'workflow') {
      setSelectedWorkflow(null);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-neutral4 hover:text-neutral5 w-full py-2">
        <ChevronRight className="w-4 h-4" />
        Schema Configuration (Optional)
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4 space-y-4">
        {/* JSON Schema info notification */}
        <Alert variant="info">
          <AlertTitle>JSON Schema Format</AlertTitle>
          <AlertDescription as="p">
            Schemas use{' '}
            <a
              href="https://json-schema.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent5Lighter"
            >
              JSON Schema
            </a>{' '}
            for validation and type checking.
          </AlertDescription>
        </Alert>

        {/* Source selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral4">Import From</label>
          <div className="flex items-center gap-2">
            <Select value={sourceType} onValueChange={v => handleSourceChange(v as SourceType)} disabled={disabled}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="scorer">Scorer</SelectItem>
              </SelectContent>
            </Select>

            {/* Workflow picker when workflow source selected */}
            {sourceType === 'workflow' && (
              <Select value={selectedWorkflow ?? ''} onValueChange={setSelectedWorkflow} disabled={disabled}>
                <SelectTrigger size="sm" className="w-48">
                  <SelectValue placeholder="Select workflow..." />
                </SelectTrigger>
                <SelectContent>
                  {workflowsLoading ? (
                    <SelectItem value="__loading__" disabled>
                      Loading...
                    </SelectItem>
                  ) : workflowOptions.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      No workflows
                    </SelectItem>
                  ) : (
                    workflowOptions.map(([id, wf]) => (
                      <SelectItem key={id} value={id}>
                        {wf.name || id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Loading indicator for workflow schema */}
            {sourceType === 'workflow' && selectedWorkflow && workflowSchemaLoading && (
              <span className="text-xs text-neutral3">Loading schema...</span>
            )}

            {/* Scorer target type picker */}
            {sourceType === 'scorer' && (
              <Select
                value={scorerTargetType}
                onValueChange={v => setScorerTargetType(v as ScorerTargetType)}
                disabled={disabled}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Helper text for scorer */}
          {sourceType === 'scorer' && (
            <p className="text-xs text-neutral3">
              {scorerTargetType === 'agent'
                ? 'For calibrating agent-type scorers'
                : 'For calibrating custom scorers (input/output as any)'}
            </p>
          )}
        </div>

        {/* Schema fields */}
        <SchemaField
          label="Input Schema"
          schemaType="input"
          value={inputSchema}
          onChange={handleInputSchemaChange}
          sourceSchema={isAutoPopulate ? sourceSchemas.inputSchema : undefined}
          autoPopulate={isAutoPopulate}
        />

        <SchemaField
          label="Ground Truth Schema"
          schemaType="output"
          value={outputSchema}
          onChange={handleOutputSchemaChange}
          sourceSchema={isAutoPopulate ? sourceSchemas.outputSchema : undefined}
          autoPopulate={isAutoPopulate}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
