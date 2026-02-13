import { Link, useParams, Navigate } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  ProcessorPanel,
  ProcessorCombobox,
  ProcessorIcon,
  useProcessor,
  Skeleton,
  PermissionDenied,
  is403ForbiddenError,
} from '@mastra/playground-ui';

export function Processor() {
  const { processorId } = useParams();
  const { data: processor, isLoading, error } = useProcessor(processorId!);

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
          <Button as={Link} to="https://mastra.ai/docs/agents/processors" target="_blank" rel="noopener noreferrer">
            <Icon>
              <DocsIcon />
            </Icon>
            Processors documentation
          </Button>
        </HeaderAction>
      </Header>

      <ProcessorPanel processorId={processorId!} />
    </div>
  );
}
