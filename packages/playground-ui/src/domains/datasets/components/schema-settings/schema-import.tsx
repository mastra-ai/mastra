import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useWorkflowSchema } from '../../hooks/use-workflow-schema';

interface SchemaImportProps {
  schemaType: 'input' | 'output';
  onImport: (schema: Record<string, unknown>) => void;
}

/**
 * JSON Schema representing MessageListInput type for agent.generate() input.
 * Supports: string, string[], message object, message object[]
 */
const AGENT_INPUT_SCHEMA: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Agent message input (MessageListInput)',
  anyOf: [
    { type: 'string', description: 'Simple text message' },
    {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of text messages',
    },
    {
      type: 'object',
      description: 'Single message object',
      properties: {
        role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
        content: { type: 'string' },
      },
      required: ['role', 'content'],
    },
    {
      type: 'array',
      description: 'Array of message objects',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
          content: { type: 'string' },
        },
        required: ['role', 'content'],
      },
    },
  ],
};

/**
 * JSON Schema for agent output (text response).
 */
const AGENT_OUTPUT_SCHEMA: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Agent text response',
  type: 'string',
};

type SourceType = 'workflow' | 'agent';

/**
 * Component for importing schema from workflows or using predefined agent schemas.
 * For workflows: fetches and imports the workflow's input/output schema.
 * For agents: uses predefined MessageListInput schema for input, string for output.
 */
export function SchemaImport({ schemaType, onImport }: SchemaImportProps) {
  const [sourceType, setSourceType] = useState<SourceType | ''>('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: workflowSchema, isLoading: schemaLoading } = useWorkflowSchema(
    sourceType === 'workflow' ? selectedWorkflow : null,
  );

  const workflowOptions = workflows ? Object.entries(workflows) : [];

  const handleImport = () => {
    if (sourceType === 'agent') {
      // Use predefined agent schema
      const schema = schemaType === 'input' ? AGENT_INPUT_SCHEMA : AGENT_OUTPUT_SCHEMA;
      onImport(schema);
      setSourceType('');
    } else if (sourceType === 'workflow' && selectedWorkflow) {
      // Use workflow schema
      const schema = schemaType === 'input' ? workflowSchema?.inputSchema : workflowSchema?.outputSchema;
      if (schema) {
        onImport(schema);
        setSelectedWorkflow(null);
        setSourceType('');
      }
    }
  };

  const canImport = () => {
    if (sourceType === 'agent') return true;
    if (sourceType === 'workflow' && selectedWorkflow && !schemaLoading) {
      const hasSchema = schemaType === 'input' ? workflowSchema?.inputSchema : workflowSchema?.outputSchema;
      return !!hasSchema;
    }
    return false;
  };

  const showNoSchemaWarning =
    sourceType === 'workflow' &&
    selectedWorkflow &&
    !schemaLoading &&
    !(schemaType === 'input' ? workflowSchema?.inputSchema : workflowSchema?.outputSchema);

  return (
    <div className="flex items-center gap-2">
      {/* Source type selector */}
      <Select value={sourceType} onValueChange={v => setSourceType(v as SourceType | '')}>
        <SelectTrigger size="sm" className="w-28">
          <SelectValue placeholder="Import..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="agent">Agent</SelectItem>
          <SelectItem value="workflow">Workflow</SelectItem>
        </SelectContent>
      </Select>

      {/* Workflow selector (only shown when workflow source selected) */}
      {sourceType === 'workflow' && (
        <Select value={selectedWorkflow ?? ''} onValueChange={setSelectedWorkflow}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="Select..." />
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

      <Button size="sm" variant="outline" onClick={handleImport} disabled={!canImport()}>
        <Download className="w-4 h-4" />
        Import
      </Button>

      {showNoSchemaWarning && <span className="text-xs text-neutral3">No {schemaType} schema</span>}
    </div>
  );
}
