import { NoDataPageLayout, PageLayout, is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useSearchParams } from 'react-router';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const { error } = useSchedules(workflowId ? { workflowId } : {});

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="schedules" />
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
