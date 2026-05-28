import {
  AlertDialog,
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
import { ArrowLeftIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { HeartbeatMetaCard } from '@/domains/heartbeats/components/heartbeat-meta-card';
import { HeartbeatTriggersList } from '@/domains/heartbeats/components/heartbeat-triggers-list';
import {
  useDeleteHeartbeat,
  useHeartbeat,
  useHeartbeatTriggers,
  useHeartbeats,
  usePauseHeartbeat,
  useResumeHeartbeat,
} from '@/domains/heartbeats/hooks/use-heartbeats';
import { useLinkComponent } from '@/lib/framework';

export default function HeartbeatPage() {
  const { scheduleId: heartbeatId } = useParams<{ scheduleId: string }>();
  const { paths } = useLinkComponent();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The detail URL only carries the heartbeat id; resolve the owning agent
  // via the global list so we can hit the agent-scoped detail/triggers
  // routes.
  const { data: heartbeats, error: listError } = useHeartbeats();
  const agentId = useMemo(() => heartbeats?.find(h => h.id === heartbeatId)?.agentId, [heartbeats, heartbeatId]);

  const { data: heartbeat, error } = useHeartbeat(agentId, heartbeatId);
  const {
    data: triggers,
    isLoading: triggersLoading,
    error: triggersError,
    hasNextPage: triggersHasNextPage,
    isFetchingNextPage: triggersIsFetchingNextPage,
    setEndOfListElement: triggersSetEndOfListElement,
  } = useHeartbeatTriggers(agentId, heartbeatId);

  const pause = usePauseHeartbeat(agentId, heartbeatId);
  const resume = useResumeHeartbeat(agentId, heartbeatId);
  const remove = useDeleteHeartbeat(agentId, heartbeatId);
  const toggleBusy = pause.isPending || resume.isPending;

  const handleConfirmDelete = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        void navigate(paths.heartbeatsLink());
      },
    });
  };

  const pageError = error ?? listError;
  if (pageError && is401UnauthorizedError(pageError)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (pageError && is403ForbiddenError(pageError)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="heartbeats" />
      </NoDataPageLayout>
    );
  }

  if (pageError) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load heartbeat" message={pageError.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row className="justify-end">
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to={paths.heartbeatsLink()} variant="ghost">
              <ArrowLeftIcon />
              Back to heartbeats
            </Button>
            {heartbeat ? (
              <>
                <Button
                  onClick={() => (heartbeat.status === 'active' ? pause.mutate() : resume.mutate())}
                  disabled={toggleBusy}
                  data-testid="heartbeat-toggle-button"
                >
                  {heartbeat.status === 'active' ? (
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
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(true)}
                  disabled={remove.isPending}
                  data-testid="heartbeat-delete-button"
                >
                  <Trash2Icon />
                  Delete
                </Button>
              </>
            ) : null}
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {heartbeat ? (
        <div className="grid gap-6 h-full overflow-hidden grid-cols-[minmax(0,22rem)_1fr]">
          <HeartbeatMetaCard heartbeat={heartbeat} />

          <div className="overflow-y-auto" data-testid="heartbeat-triggers-panel">
            <Txt variant="ui-md" className="mb-3">
              Trigger history
            </Txt>
            {triggersError ? (
              <ErrorState title="Failed to load trigger history" message={triggersError.message} />
            ) : (
              <HeartbeatTriggersList
                triggers={triggers ?? []}
                isLoading={triggersLoading}
                hasNextPage={triggersHasNextPage}
                isFetchingNextPage={triggersIsFetchingNextPage}
                setEndOfListElement={triggersSetEndOfListElement}
              />
            )}
          </div>
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete this heartbeat?</AlertDialog.Title>
            <AlertDialog.Description>
              This will permanently delete the heartbeat and stop future runs. Trigger history will be removed. This
              action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={remove.isPending}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={handleConfirmDelete}
              disabled={remove.isPending}
              data-testid="heartbeat-delete-confirm"
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </PageLayout>
  );
}
