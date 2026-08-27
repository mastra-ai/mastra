import { Button } from '@mastra/playground-ui/components/Button';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { NoWorkflowsInfo } from '@/domains/workflows/components/workflows-list/no-workflows-info';
import { WorkflowsList } from '@/domains/workflows/components/workflows-list/workflows-list';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="workflows" title="Failed to load workflows" />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoWorkflowsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row align="center" stack="responsive">
          <div className="max-w-120 flex-1">
            <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
          </div>
          <Button as={Link} to="/workflows/schedules" variant="primary" className="shrink-0">
            <CalendarClockIcon />
            Schedules
          </Button>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <WorkflowsList workflows={workflows || {}} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export default Workflows;
