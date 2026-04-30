import {
  Breadcrumb,
  Button,
  Crumb,
  DocsIcon,
  Header,
  HeaderAction,
  Icon,
  PermissionDenied,
  ProcessorIcon,
  SessionExpired,
  Skeleton,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { Link, useParams, Navigate } from 'react-router';
import { ProcessorCombobox } from '@/domains/processors/components/processor-combobox';
import { ProcessorPanel } from '@/domains/processors/components/processor-panel';
import { useProcessor } from '@/domains/processors/hooks/use-processors';

export function Processor() {
  const { processorId } = useParams();
  const { data: processor, isLoading, error } = useProcessor(processorId!);

  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="h-full w-full overflow-y-hidden">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/processors`}>
              <Icon>
                <ProcessorIcon />
              </Icon>
              Processors
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              {processorId}
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </div>
    );
  }

  // 403 check - permission denied for processors
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="h-full w-full overflow-y-hidden">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/processors`}>
              <Icon>
                <ProcessorIcon />
              </Icon>
              Processors
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              {processorId}
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="processors" />
        </div>
      </div>
    );
  }

  // If this is a workflow processor, redirect to the workflow graph UI
  if (!isLoading && processor?.isWorkflow) {
    return <Navigate to={`/workflows/${processorId}/graph`} replace />;
  }

  if (isLoading) {
    return (
      <div className="h-full w-full overflow-y-hidden">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/processors`}>
              <Icon>
                <ProcessorIcon />
              </Icon>
              Processors
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              <Skeleton className="h-6 w-32" />
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/processors`}>
            <Icon>
              <ProcessorIcon />
            </Icon>
            Processors
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <ProcessorCombobox value={processorId} variant="ghost" />
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/docs/agents/processors"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            Processors documentation
          </Button>
        </HeaderAction>
      </Header>

      <ProcessorPanel processorId={processorId!} />
    </div>
  );
}
