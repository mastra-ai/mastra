import {
  Button,
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  Txt,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { HeartbeatMetaCard } from '@/domains/heartbeats/components/heartbeat-meta-card';
import { ScheduleTriggersList } from '@/domains/schedules/components/schedule-triggers-list';
import { useSchedule } from '@/domains/schedules/hooks/use-schedule';
import { useScheduleTriggers } from '@/domains/schedules/hooks/use-schedule-triggers';
import { useToggleSchedule } from '@/domains/schedules/hooks/use-toggle-schedule';
import { useLinkComponent } from '@/lib/framework';

export default function HeartbeatPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
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
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="heartbeats" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load heartbeat" message={error.message} />
      </NoDataPageLayout>
    );
  }

  const workflowId = schedule?.target.type === 'workflow' ? schedule.target.workflowId : undefined;

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row className="justify-end">
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to={paths.heartbeatsLink()} variant="ghost">
              <ArrowLeftIcon />
              Back to heartbeats
            </Button>
            {schedule ? (
              <Button
                onClick={() => toggle.mutate(schedule.status === 'active' ? 'pause' : 'resume')}
                disabled={toggle.isPending}
                data-testid="heartbeat-toggle-button"
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
        <div className="grid gap-6 h-full overflow-hidden grid-cols-[minmax(0,22rem)_1fr]">
          <HeartbeatMetaCard schedule={schedule} />

          <div className="overflow-y-auto" data-testid="heartbeat-triggers-panel">
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
