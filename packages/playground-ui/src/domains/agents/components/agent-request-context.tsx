import { useMemo } from 'react';
import { ZodType } from 'zod';
import { CopyIcon } from 'lucide-react';
import { DynamicForm, resolveSerializedZodOutput } from '@/lib/form';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { useAgent } from '../hooks/use-agent';
import { Txt } from '@/ds/components/Txt/Txt';
import { Skeleton } from '@/ds/components/Skeleton/skeleton';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { usePlaygroundStore } from '@/store/playground-store';

export interface AgentRequestContextProps {
  agentId: string;
}

export const AgentRequestContext = ({ agentId }: AgentRequestContextProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { requestContext: playgroundRequestContext, setRequestContext } = usePlaygroundStore();

  const handleCopyRequestContext = () => {
    navigator.clipboard.writeText(JSON.stringify(playgroundRequestContext, null, 2));
  };

  // Parse requestContextSchema if the agent has one
  const zodRequestContextSchema: ZodType | undefined = useMemo(() => {
    if (!agent?.requestContextSchema) return undefined;
    try {
      return resolveSerializedZodOutput(jsonSchemaToZod(parse(agent.requestContextSchema)));
    } catch (e) {
      console.error('Error parsing agent requestContextSchema:', e);
      return undefined;
    }
  }, [agent?.requestContextSchema]);

  if (isLoading) {
    return <Skeleton className="h-full" />;
  }

  if (!agent || !zodRequestContextSchema) {
    return (
      <div className="p-5">
        <Txt as="p" variant="ui-md" className="text-icon3">
          This agent does not have a request context schema defined.
        </Txt>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <Txt as="p" variant="ui-sm" className="text-icon3">
          This agent has a request context schema defined.
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
