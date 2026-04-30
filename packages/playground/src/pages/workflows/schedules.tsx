import {
  Button,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, CalendarClockIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const { error } = useSchedules(workflowId ? { workflowId } : {});

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Schedules" icon={<CalendarClockIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Schedules" icon={<CalendarClockIcon />}>
        <PermissionDenied resource="schedules" />
      </NoDataPageLayout>
    );
  }

  const backTo = workflowId ? `/workflows/${workflowId}` : '/workflows';
  const backLabel = workflowId ? 'Back to workflow' : 'Back to workflows';

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <CalendarClockIcon /> {workflowId ? `Schedules · ${workflowId}` : 'Schedules'}
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to={backTo} variant="ghost">
              <ArrowLeftIcon />
              {backLabel}
            </Button>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <SchedulesPageContent workflowId={workflowId} />
    </PageLayout>
  );
}
