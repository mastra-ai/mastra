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
import { Link } from 'react-router';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export default function SchedulesPage() {
  const { error } = useSchedules();

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

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <CalendarClockIcon /> Schedules
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to="/workflows" variant="ghost">
              <ArrowLeftIcon />
              Back to workflows
            </Button>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <SchedulesPageContent />
    </PageLayout>
  );
}
