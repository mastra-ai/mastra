import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeftIcon, CalendarClockIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { decodeRouteParam, navCrumb } from '@/domains/navigation/crumbs';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { ScheduleTriggersList } from '@/domains/schedules/components/schedule-triggers-list';
import { useSchedule } from '@/domains/schedules/hooks/use-schedule';
import { useScheduleTriggers } from '@/domains/schedules/hooks/use-schedule-triggers';
import { useToggleSchedule } from '@/domains/schedules/hooks/use-toggle-schedule';
import { schedulesCrumb } from '@/domains/workflows/schedules-crumb';
import { useLinkComponent } from '@/lib/framework';

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Txt variant="meta" tone="muted" className="tracking-wide uppercase">
        {label}
      </Txt>
      <div className="text-body">{children}</div>
    </div>
  );
}

export default function SchedulePage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const crumbs = [
    navCrumb('/workflows'),
    schedulesCrumb,
    { id: 'schedule', label: decodeRouteParam(scheduleId), icon: CalendarClockIcon },
  ];
  const { paths } = useLinkComponent();
  const { data: schedule, error } = useSchedule(scheduleId);
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
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{scheduleId}</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{scheduleId}</h1>
        <PermissionDenied variant="fill" resource="schedules" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{scheduleId}</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load schedule" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  const workflowId = schedule?.workflowId;
  const agentId = schedule?.agentId;

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.End>
            <Button render={<Link to={paths.schedulesLink()} />} variant="ghost" icon={<ArrowLeftIcon />}>
              Back to schedules
            </Button>
            {workflowId ? (
              <Button icon={<WorkflowIcon />} render={<Link to={paths.workflowLink(workflowId)} />} variant="ghost">
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
          </ActionRow.End>
        </ActionRow>
      }
    >
      <h1 className="sr-only">{scheduleId}</h1>
      {schedule ? (
        <div className="grid h-full grid-cols-[minmax(0,20rem)_1fr] gap-4 overflow-hidden">
          <div className="flex h-fit flex-col gap-4 rounded-md border border-border p-4">
            <MetaItem label={agentId ? 'Agent' : 'Workflow'}>
              {workflowId ? (
                <Link to={paths.workflowLink(workflowId)} className="text-accent1 hover:underline">
                  {workflowId}
                </Link>
              ) : agentId ? (
                <Link to={paths.agentLink(agentId)} className="text-accent1 hover:underline">
                  {agentId}
                </Link>
              ) : (
                '—'
              )}
            </MetaItem>
            <MetaItem label="Cron">
              <Txt as="span" variant="body" font="mono">
                {schedule.cron}
              </Txt>
              {schedule.timezone ? (
                <span className="ml-2 text-caption text-muted-foreground">{schedule.timezone}</span>
              ) : null}
            </MetaItem>
            <MetaItem label="Status">
              <ScheduleStatusText status={schedule.status} />
            </MetaItem>
            <MetaItem label="Next fire">
              {schedule.nextFireAt ? <RelativeTimestamp value={schedule.nextFireAt} /> : '—'}
            </MetaItem>
          </div>

          <div className="overflow-y-auto" data-testid="schedule-triggers-panel">
            <Txt variant="body" className="mb-3">
              Trigger history
            </Txt>
            {triggersError ? (
              <EmptyState
                tone="error"
                titleSlot="Failed to load trigger history"
                descriptionSlot={triggersError.message}
              />
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
