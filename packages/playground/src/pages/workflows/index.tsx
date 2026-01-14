import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  WorkflowTable,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  WorkflowIcon,
  useWorkflows,
  useWorkflowDefinitions,
  useWorkflowDefinitionMutations,
} from '@mastra/playground-ui';

import { Link, useNavigate } from 'react-router';
import { useMemo, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';

function Workflows() {
  const navigate = useNavigate();
  const { data: workflows, isLoading } = useWorkflows();
  const { data: storedWorkflowsData, isLoading: isLoadingStored } = useWorkflowDefinitions();
  const { createWorkflowDefinition } = useWorkflowDefinitionMutations();

  // Transform stored workflow definitions to table format
  const storedWorkflows = useMemo(() => {
    if (!storedWorkflowsData?.definitions) return [];

    return storedWorkflowsData.definitions.map(def => ({
      id: def.id,
      name: def.name,
      description: def.description,
      steps: def.steps as Record<string, unknown>,
      stepGraph: def.stepGraph,
      workflowType: 'stored' as const,
    }));
  }, [storedWorkflowsData]);

  const handleCreateWorkflow = useCallback(async () => {
    // Generate a unique ID for the new workflow
    const timestamp = Date.now();
    const workflowId = `workflow-${timestamp}`;

    try {
      // Default input schema with a prompt field for common agent workflows
      const defaultInputSchema = {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The input prompt for the workflow',
          },
        },
        required: ['prompt'],
      };

      await createWorkflowDefinition.mutateAsync({
        id: workflowId,
        name: 'Untitled Workflow',
        description: '',
        inputSchema: defaultInputSchema,
        outputSchema: {},
        stepGraph: [],
        steps: {},
      });

      // Navigate to the builder
      navigate(`/workflows/${workflowId}/edit`);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  }, [createWorkflowDefinition, navigate]);

  const combinedLoading = isLoading || isLoadingStored;
  const isEmpty = !combinedLoading && Object.keys(workflows || {}).length === 0 && storedWorkflows.length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <WorkflowIcon />
          </Icon>
          Workflows
        </HeaderTitle>

        <HeaderAction>
          <Button variant="light" onClick={handleCreateWorkflow} disabled={createWorkflowDefinition.isPending}>
            <Icon>
              {createWorkflowDefinition.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Icon>
            {createWorkflowDefinition.isPending ? 'Creating...' : 'Create Workflow'}
          </Button>
          <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Docs
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <WorkflowTable
          workflows={workflows || {}}
          storedWorkflows={storedWorkflows}
          isLoading={isLoading}
          isLoadingStored={isLoadingStored}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
