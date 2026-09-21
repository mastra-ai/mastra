import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useSearchParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb } from '@/domains/navigation/crumbs';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';
import { schedulesCrumb } from '@/domains/workflows/schedules-crumb';

const crumbs = [navCrumb('/workflows'), schedulesCrumb];

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const { error } = useSchedules(workflowId ? { workflowId } : {});

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <PermissionDenied resource="schedules" />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout {...pageHeaderProps(crumbs)}>
      <div className="h-full">
        <SchedulesPageContent workflowId={workflowId} />
      </div>
    </PageLayout>
  );
}
