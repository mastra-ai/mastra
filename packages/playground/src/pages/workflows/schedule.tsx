import {
  Button,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  Txt,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, CalendarClockIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { ScheduleTriggersList } from '@/domains/schedules/components/schedule-triggers-list';
import { useSchedule } from '@/domains/schedules/hooks/use-schedule';
import { useScheduleTriggers } from '@/domains/schedules/hooks/use-schedule-triggers';
import { useToggleSchedule } from '@/domains/schedules/hooks/use-toggle-schedule';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Txt variant="ui-xs" className="text-neutral4 uppercase tracking-wide">
        {label}
      </Txt>
      <div className="text-ui-md">{children}</div>
    </div>
  );
}

export default function SchedulePage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { paths } = useLinkComponent();
  const { data: schedule, isLoading, error } = useSchedule(scheduleId);
  const {
    data: triggers,
    isLoading: triggersLoading,
    error: triggersError,
    hasNextPage: triggersHasNextPage,
    isFetchingNextPage: triggersIsFetchingNextPage,
    setEndOfListElement: triggersSetEndOfListElement,
  } = useScheduleTriggers(scheduleId);
  const toggle = useToggleSchedule(scheduleId);

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Schedule" icon={<CalendarClockIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Schedule" icon={<CalendarClockIcon />}>
        <PermissionDenied resource="schedules" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Schedule" icon={<CalendarClockIcon />}>
        <ErrorState title="Failed to load schedule" message={error.message} />
      </NoDataPageLayout>
    );
  }

  const workflowId = schedule?.target.type === 'workflow' ? schedule.target.workflowId : undefined;

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <CalendarClockIcon />
                <span className="font-mono">{schedule?.id ?? scheduleId}</span>
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to={paths.schedulesLink()} variant="ghost">
              <ArrowLeftIcon />
              Back to schedules
            </Button>
            {workflowId ? (
              <Button as={Link} to={paths.workflowLink(workflowId)} variant="ghost">
                Open workflow
              </Button>
            ) : null}
            {schedule ? (
              <Button
                onClick={() => toggle.mutate(schedule.status === 'active' ? 'pause' : 'resume')}
                disabled={toggle.isPending}
                data-testid="schedule-toggle-button"
              >
                {schedule.status === 'active' ? (
                  <>
                    <PauseIcon />
                    Pause
                  </>
                ) : (
                  <>
                    <PlayIcon />
                    Resume
                  </>
                )}
              </Button>
            ) : null}
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {schedule ? (
        <div className="grid gap-6 h-full overflow-hidden grid-cols-[minmax(0,20rem)_1fr]">
          <div className="flex flex-col gap-4 border border-border1 rounded-md p-4 h-fit">
            <MetaItem label="Workflow">
              {workflowId ? (
                <Link to={paths.workflowLink(workflowId)} className="text-accent1 hover:underline">
                  {workflowId}
                </Link>
              ) : (
                '—'
              )}
            </MetaItem>
            <MetaItem label="Cron">
              <code className="font-mono text-ui-md">{schedule.cron}</code>
              {schedule.timezone ? <span className="text-neutral4 ml-2 text-ui-sm">{schedule.timezone}</span> : null}
            </MetaItem>
            <MetaItem label="Status">
              <ScheduleStatusText status={schedule.status} />
            </MetaItem>
            <MetaItem label="Next fire">
              <span title={formatScheduleTimestamp(schedule.nextFireAt)}>
                {formatRelativeTime(schedule.nextFireAt)}
              </span>
            </MetaItem>
          </div>

          <div className="overflow-y-auto" data-testid="schedule-triggers-panel">
            <Txt variant="ui-md" className="mb-3">
              Trigger history
            </Txt>
            {triggersError ? (
              <ErrorState title="Failed to load trigger history" message={triggersError.message} />
            ) : (
              <ScheduleTriggersList
                triggers={triggers ?? []}
                isLoading={triggersLoading}
                workflowId={workflowId}
                hasNextPage={triggersHasNextPage}
                isFetchingNextPage={triggersIsFetchingNextPage}
                setEndOfListElement={triggersSetEndOfListElement}
              />
            )}
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}
