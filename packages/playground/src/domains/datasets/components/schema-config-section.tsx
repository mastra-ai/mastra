import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import type { JSONSchema7 } from 'json-schema';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAgentSchema } from '../hooks/use-agent-schema';
import { useScorerSchema } from '../hooks/use-scorer-schema';
import { SchemaField } from './schema-settings/schema-field';

type SourceType = 'custom' | 'agent' | 'workflow' | 'scorer';
type ScorerTargetType = 'agent' | 'custom';
type SchemaTab = 'input' | 'groundTruth' | 'requestContext';
type SchemaValue = Record<string, unknown> | null;

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

  const [workflowSchemaLoading, setWorkflowSchemaLoading] = useState(false);
  // Bumped whenever a source fills the editors, so they remount with the new text.
  const [fillCount, setFillCount] = useState(0);
  // The workflow whose schema is being fetched; a slower, older response must not win.
  const requestedWorkflow = useRef<string | null>(null);
  const client = useMastraClient();

  // Static schemas for agent and scorer
  const agentSchema = useAgentSchema();
  const scorerSchema = useScorerSchema();

  const fillFromSource = (source: {
    inputSchema: SchemaValue | JSONSchema7;
    outputSchema: SchemaValue | JSONSchema7;
  }) => {
    onChange({
      inputSchema: (source.inputSchema as SchemaValue) ?? null,
      outputSchema: (source.outputSchema as SchemaValue) ?? null,
      requestContextSchema: requestContextSchema ?? null,
    });
    setFillCount(count => count + 1);
  };

  const fillFromScorer = (target: ScorerTargetType) =>
    fillFromSource({
      inputSchema: target === 'agent' ? scorerSchema.agentInputSchema : scorerSchema.customInputSchema,
      outputSchema: scorerSchema.outputSchema,
    });

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
    setSelectedWorkflow(null);
    requestedWorkflow.current = null;
    setWorkflowSchemaLoading(false);
    if (value === 'agent') fillFromSource(agentSchema);
    if (value === 'scorer') fillFromScorer(scorerTargetType);
  };

  const handleScorerTargetChange = (value: ScorerTargetType) => {
    setScorerTargetType(value);
    fillFromScorer(value);
  };

  const handleWorkflowChange = async (workflowId: string) => {
    setSelectedWorkflow(workflowId);
    requestedWorkflow.current = workflowId;
    setWorkflowSchemaLoading(true);
    try {
      const schema = await client.getWorkflow(workflowId).getSchema();
      if (requestedWorkflow.current === workflowId) fillFromSource(schema);
    } catch (error) {
      if (requestedWorkflow.current === workflowId) {
        toast.error(`Failed to load the workflow schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      if (requestedWorkflow.current === workflowId) setWorkflowSchemaLoading(false);
    }
  };

  const fields = (
    <>
      <Notice variant="info" title={SCHEMA_HELP[tab].title}>
        <Notice.Message>{SCHEMA_HELP[tab].message}</Notice.Message>
      </Notice>

      {/* keepMounted preserves an unfinished (invalid) draft when switching tabs. */}
      <Tabs<SchemaTab> defaultTab="input" value={tab} onValueChange={setTab} className="grid gap-4">
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
            <Select
              value={selectedWorkflow ?? ''}
              onValueChange={id => void handleWorkflowChange(id)}
              disabled={disabled}
            >
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
              onValueChange={v => handleScorerTargetChange(v as ScorerTargetType)}
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

        {workflowSchemaLoading && (
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

        <TabContent value="input" keepMounted flush>
          <SchemaField key={fillCount} label="Input schema" value={inputSchema} onChange={handleInputSchemaChange} />
        </TabContent>
        <TabContent value="groundTruth" keepMounted flush>
          <SchemaField
            key={fillCount}
            label="Ground truth schema"
            value={outputSchema}
            onChange={handleOutputSchemaChange}
          />
        </TabContent>
        <TabContent value="requestContext" keepMounted flush>
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
