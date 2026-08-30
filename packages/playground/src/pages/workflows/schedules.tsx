import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { isAuthError } from '@mastra/playground-ui/utils/errors';
import { useSearchParams } from 'react-router';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const { error } = useSchedules(workflowId ? { workflowId } : {});

  if (error && isAuthError(error)) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="schedules" title="Failed to load schedules" />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="h-full">
        <SchedulesPageContent workflowId={workflowId} />
      </div>
    </PageLayout>
  );
}
