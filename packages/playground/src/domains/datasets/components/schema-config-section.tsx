'use client';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useWorkflowSchema } from '@mastra/react/hooks/datasets';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import type { JSONSchema7 } from 'json-schema';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAgentSchema } from '../hooks/use-agent-schema';
import { useScorerSchema } from '../hooks/use-scorer-schema';
import { SchemaField } from './schema-settings/schema-field';

type SourceType = 'custom' | 'agent' | 'workflow' | 'scorer';
type ScorerTargetType = 'agent' | 'custom';
type SchemaTab = 'input' | 'groundTruth' | 'requestContext';

const jsonSchemaLink = (
  <a
    href="https://json-schema.org/"
    target="_blank"
    rel="noopener noreferrer"
    className="underline hover:text-info-indicator"
  >
    JSON Schema
  </a>
);

const SCHEMA_HELP: Record<SchemaTab, { title: string; message: ReactNode }> = {
  input: {
    title: "Checks every item's input",
    message: (
      <>
        Items whose input doesn't match this {jsonSchemaLink} are rejected, whether you add them by hand or import a
        CSV. Leave it empty to accept any input.
      </>
    ),
  },
  groundTruth: {
    title: "Checks every item's expected output",
    message: (
      <>
        Ground truth is the answer scorers compare the target's output against. Items whose ground truth doesn't match
        this {jsonSchemaLink} are rejected. Leave it empty to accept any value.
      </>
    ),
  },
  requestContext: {
    title: 'Describes what experiments can pass to the target',
    message: (
      <>
        When you run an experiment, Studio turns this {jsonSchemaLink} into a form for request context values such as a
        user ID or locale. Items aren't checked against it.
      </>
    ),
  },
};

interface SchemaConfigSectionProps {
  inputSchema: Record<string, unknown> | null | undefined;
  outputSchema: Record<string, unknown> | null | undefined;
  requestContextSchema: Record<string, unknown> | null | undefined;
  onChange: (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
    requestContextSchema: Record<string, unknown> | null;
  }) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
  /** When false, the fields are always shown, without the "Schema Configuration" toggle. */
  collapsible?: boolean;
}

/**
 * Collapsible section for configuring dataset schemas.
 * Supports source-based auto-population from Agent, Workflow, or Scorer schemas.
 */
export function SchemaConfigSection({
  inputSchema,
  outputSchema,
  requestContextSchema,
  onChange,
  disabled = false,
  defaultOpen = false,
  collapsible = true,
}: SchemaConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<SchemaTab>('input');
  const [sourceType, setSourceType] = useState<SourceType>('custom');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [scorerTargetType, setScorerTargetType] = useState<ScorerTargetType>('agent');

  // Fetch workflows for workflow source selection
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const workflowOptions = workflows ? Object.entries(workflows) : [];

  // Fetch workflow schema when workflow selected
  const { data: workflowSchema, isLoading: workflowSchemaLoading } = useWorkflowSchema({
    workflowId: sourceType === 'workflow' ? selectedWorkflow : null,
    queryOptions: { enabled: !!(sourceType === 'workflow' ? selectedWorkflow : null) },
  });

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

  // The source whose schemas were last written into the editors. Filling once per source keeps
  // refetches (e.g. on window focus) from overwriting what the user has edited since.
  const filledSourceKeyRef = useRef<string | null>(null);

  // Picking a source fills the input and ground truth editors with its schemas.
  useEffect(() => {
    if (sourceType === 'custom') {
      filledSourceKeyRef.current = null;
      return;
    }
    if (sourceType === 'workflow' && (!selectedWorkflow || !workflowSchema)) return;

    const sourceKey =
      sourceType === 'workflow'
        ? `workflow:${selectedWorkflow}`
        : sourceType === 'scorer'
          ? `scorer:${scorerTargetType}`
          : sourceType;
    if (filledSourceKeyRef.current === sourceKey) return;
    filledSourceKeyRef.current = sourceKey;

    onChange({
      inputSchema: (sourceSchemas.inputSchema as Record<string, unknown> | null) ?? null,
      outputSchema: (sourceSchemas.outputSchema as Record<string, unknown> | null) ?? null,
      requestContextSchema: requestContextSchema ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, selectedWorkflow, workflowSchema, scorerTargetType]);

  const handleInputSchemaChange = (schema: Record<string, unknown> | null) => {
    onChange({
      inputSchema: schema,
      outputSchema: outputSchema ?? null,
      requestContextSchema: requestContextSchema ?? null,
    });
  };

  const handleOutputSchemaChange = (schema: Record<string, unknown> | null) => {
    onChange({
      inputSchema: inputSchema ?? null,
      outputSchema: schema,
      requestContextSchema: requestContextSchema ?? null,
    });
  };

  const handleRequestContextSchemaChange = (schema: Record<string, unknown> | null) => {
    onChange({
      inputSchema: inputSchema ?? null,
      outputSchema: outputSchema ?? null,
      requestContextSchema: schema,
    });
  };

  const handleSourceChange = (value: SourceType) => {
    setSourceType(value);
    // Reset workflow selection when switching away from workflow
    if (value !== 'workflow') {
      setSelectedWorkflow(null);
    }
  };

  const fields = (
    <>
      <Notice variant="info" title={SCHEMA_HELP[tab].title}>
        <Notice.Message>{SCHEMA_HELP[tab].message}</Notice.Message>
      </Notice>

      {/* keepMounted preserves an unfinished (invalid) draft when switching tabs. */}
      <Tabs<SchemaTab> defaultTab="input" value={tab} onValueChange={setTab}>
        <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center">
          <Field orientation="horizontal" className="shrink-0">
            <FieldLabel>From</FieldLabel>
            <Select value={sourceType} onValueChange={v => handleSourceChange(v as SourceType)} disabled={disabled}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="scorer">Scorer</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {sourceType === 'workflow' && (
            <Select value={selectedWorkflow ?? ''} onValueChange={setSelectedWorkflow} disabled={disabled}>
              <SelectTrigger aria-label="Workflow" size="sm" className="w-44">
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

          {sourceType === 'scorer' && (
            <Select
              value={scorerTargetType}
              onValueChange={v => setScorerTargetType(v as ScorerTargetType)}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Scorer target type" size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* TabList renders inside a w-full scroller; sizing this wrapper to its content keeps it on the select's row (md+) when it fits. */}
          <div className="min-w-0 self-stretch md:grow md:basis-auto md:self-auto">
            <TabList variant="pill" size="sm" className="md:ml-auto">
              <Tab value="input">Input</Tab>
              <Tab value="groundTruth">Ground truth</Tab>
              <Tab value="requestContext">Request context</Tab>
            </TabList>
          </div>
        </div>

        {sourceType === 'workflow' && selectedWorkflow && workflowSchemaLoading && (
          <Txt variant="caption" tone="muted">
            Loading schema...
          </Txt>
        )}

        {sourceType === 'scorer' && (
          <Txt variant="caption" tone="muted">
            {scorerTargetType === 'agent'
              ? 'For calibrating agent-type scorers'
              : 'For calibrating custom scorers (input/output as any)'}
          </Txt>
        )}

        <TabContent value="input" keepMounted>
          <SchemaField label="Input schema" value={inputSchema} onChange={handleInputSchemaChange} />
        </TabContent>
        <TabContent value="groundTruth" keepMounted>
          <SchemaField label="Ground truth schema" value={outputSchema} onChange={handleOutputSchemaChange} />
        </TabContent>
        <TabContent value="requestContext" keepMounted>
          <SchemaField
            label="Request context schema"
            value={requestContextSchema}
            onChange={handleRequestContextSchemaChange}
          />
        </TabContent>
      </Tabs>
    </>
  );

  if (!collapsible) {
    return <div className="space-y-4">{fields}</div>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={cn(quietTextHover, 'flex w-full items-center gap-2 py-2', 'text-subheading')}>
        <DisclosureChevron direction="right" className="size-4" />
        Schema Configuration (Optional)
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 pt-4">{fields}</CollapsibleContent>
    </Collapsible>
  );
}
