import {
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  ProcessorIcon,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { NoProcessorsInfo } from '@/domains/processors/components/processors-list/no-processors-info';
import { ProcessorsList } from '@/domains/processors/components/processors-list/processors-list';
import { useProcessors } from '@/domains/processors/hooks/use-processors';

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Processors" icon={<ProcessorIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Processors" icon={<ProcessorIcon />}>
        <PermissionDenied resource="processors" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Processors" icon={<ProcessorIcon />}>
        <ErrorState title="Failed to load processors" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(processors).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Processors" icon={<ProcessorIcon />}>
        <NoProcessorsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <ProcessorIcon /> Processors
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/processors"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Processors documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <ProcessorsList processors={processors} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
