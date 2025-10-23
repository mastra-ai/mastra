import { useWorkflow } from '@/hooks/use-workflow';
import {
  Entity,
  EntityCaret,
  EntityContent,
  EntityTrigger,
  Entry,
  EntryTitle,
  Icon,
  CodeCopyButton,
  CodeBlock,
  Workflow,
  WorkflowIcon,
  WorkflowProps,
} from '@mastra/react';

export interface ToolWorkflowProps {
  workflowId: string;
  input: Record<string, any>;
  output: Record<string, any>;
}

export const ToolWorkflow = ({ workflowId, input, output }: ToolWorkflowProps) => {
  const { data: workflow, isLoading } = useWorkflow(workflowId);

  return (
    <Entity variant="workflow" initialExpanded>
      <EntityTrigger>
        <Icon>
          <WorkflowIcon />
        </Icon>
        {workflowId}
        <EntityCaret />
      </EntityTrigger>

      <EntityContent>
        {isLoading ? (
          <div>Loading...</div>
        ) : workflow ? (
          <>
            <Entry>
              <EntryTitle>Workflow Input</EntryTitle>
              <CodeBlock
                code={JSON.stringify(input, null, 2)}
                language="json"
                cta={<CodeCopyButton code={JSON.stringify(input, null, 2)} />}
              />
            </Entry>
            <Entry>
              <EntryTitle>Workflow Result</EntryTitle>
              <div className="w-full h-[60vh]">
                <Workflow workflow={workflow} workflowResult={output as WorkflowProps['workflowResult']} />
              </div>
            </Entry>
          </>
        ) : (
          'Workflow not found'
        )}
      </EntityContent>
    </Entity>
  );
};
