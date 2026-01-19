import { Link, useParams, Navigate } from 'react-router';
import { Cpu } from 'lucide-react';

import {
  Header,
  Breadcrumb,
  Crumb,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  ProcessorPanel,
  HeaderGroup,
  useProcessor,
  Skeleton,
} from '@mastra/playground-ui';

const Processor = () => {
  const { processorId } = useParams();
  const { data: processor, isLoading } = useProcessor(processorId!);

  // If this is a workflow processor, redirect to the workflow graph UI
  if (!isLoading && processor?.isWorkflow) {
    return <Navigate to={`/workflows/${processorId}/graph`} replace />;
  }

  if (isLoading) {
    return (
      <div className="h-full w-full overflow-y-hidden">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/processors`} isCurrent>
              <Icon>
                <Cpu />
              </Icon>
              Processors
            </Crumb>
          </Breadcrumb>
          <HeaderGroup>
            <Skeleton className="h-6 w-48" />
          </HeaderGroup>
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
          <Crumb as={Link} to={`/processors`} isCurrent>
            <Icon>
              <Cpu />
            </Icon>
            Processors
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          <div className="text-icon1 font-medium truncate max-w-md">{processorId}</div>
        </HeaderGroup>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/processors" target="_blank">
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
};

export default Processor;
