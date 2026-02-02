import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useWorkflowSchema } from '../../hooks/use-workflow-schema';

interface WorkflowSchemaImportProps {
  schemaType: 'input' | 'output';
  onImport: (schema: Record<string, unknown>) => void;
}

/**
 * Component for selecting a workflow and importing its input or output schema.
 * Shows a workflow dropdown and an Import button that calls onImport with the selected schema.
 */
export function WorkflowSchemaImport({ schemaType, onImport }: WorkflowSchemaImportProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  // useWorkflows returns Record<string, GetWorkflowResponse>
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: schema, isLoading: schemaLoading } = useWorkflowSchema(selectedWorkflow);

  // Convert workflows record to array for Select options
  const workflowOptions = workflows ? Object.entries(workflows) : [];

  const handleImport = () => {
    const schemaToImport = schemaType === 'input' ? schema?.inputSchema : schema?.outputSchema;
    if (schemaToImport) {
      onImport(schemaToImport);
      setSelectedWorkflow(null);
    }
  };

  const hasSchema = schemaType === 'input' ? schema?.inputSchema : schema?.outputSchema;

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedWorkflow ?? ''} onValueChange={setSelectedWorkflow}>
        <SelectTrigger size="sm" className="w-48">
          <SelectValue placeholder="Select workflow..." />
        </SelectTrigger>
        <SelectContent>
          {workflowsLoading ? (
            <SelectItem value="" disabled>
              Loading...
            </SelectItem>
          ) : workflowOptions.length === 0 ? (
            <SelectItem value="" disabled>
              No workflows available
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

      <Button
        size="sm"
        variant="outline"
        onClick={handleImport}
        disabled={!selectedWorkflow || schemaLoading || !hasSchema}
      >
        <Download className="w-4 h-4" />
        Import {schemaType}
      </Button>

      {selectedWorkflow && !schemaLoading && !hasSchema && (
        <span className="text-xs text-neutral3">No {schemaType} schema defined</span>
      )}
    </div>
  );
}
