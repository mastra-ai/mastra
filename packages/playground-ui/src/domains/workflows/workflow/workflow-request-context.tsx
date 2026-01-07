import { useMemo } from 'react';
import { ZodType } from 'zod';
import { CopyIcon } from 'lucide-react';
import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { useWorkflow } from '@/hooks/use-workflows';
import { Txt } from '@/ds/components/Txt/Txt';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { usePlaygroundStore } from '@/store/playground-store';

export interface WorkflowRequestContextProps {
  workflowId: string;
}

export const WorkflowRequestContext = ({ workflowId }: WorkflowRequestContextProps) => {
  const { data: workflow, isLoading } = useWorkflow(workflowId);
  const { requestContext: playgroundRequestContext, setRequestContext } = usePlaygroundStore();

  const handleCopyRequestContext = () => {
    navigator.clipboard.writeText(JSON.stringify(playgroundRequestContext, null, 2));
  };

  // Parse requestContextSchema if the workflow has one
  const zodRequestContextSchema: ZodType | undefined = useMemo(() => {
    if (!workflow?.requestContextSchema) return undefined;
    try {
      return resolveSerializedZodOutput(jsonSchemaToZod(parse(workflow.requestContextSchema)));
    } catch (e) {
      console.error('Error parsing workflow requestContextSchema:', e);
      return undefined;
    }
  }, [workflow?.requestContextSchema]);

  if (isLoading) {
    return <Skeleton className="h-full" />;
  }

  if (!workflow || !zodRequestContextSchema) {
    return (
      <div className="p-5">
        <Txt as="p" variant="ui-md" className="text-icon3">
          This workflow does not have a request context schema defined.
        </Txt>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <Txt as="p" variant="ui-sm" className="text-icon3">
          This workflow has a request context schema defined.
        </Txt>
        <Button variant="light" size="md" onClick={handleCopyRequestContext}>
          <Icon>
            <CopyIcon className="h-4 w-4" />
          </Icon>
        </Button>
      </div>
      <DynamicForm
        schema={zodRequestContextSchema}
        defaultValues={playgroundRequestContext}
        onChange={(values: unknown) => {
          setRequestContext(values as Record<string, any>);
        }}
        hideSubmitButton={true}
        className="h-auto"
      />
    </div>
  );
};
