import type { Monitor } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { MonitorDialog, MonitorEventsDialog, MonitorsList, useMonitors } from '@/domains/monitors';
import { useScorers } from '@/domains/scores';

export default function Monitors() {
  const { data, isLoading, error } = useMonitors();
  const { data: scorers = {} } = useScorers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Monitor | undefined>(undefined);
  const [eventsMonitor, setEventsMonitor] = useState<Monitor | undefined>(undefined);

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
        <PermissionDenied resource="monitors" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load monitors" message={error.message} />
      </NoDataPageLayout>
    );
  }

  const monitors = data?.monitors ?? [];
  const scorerOptions = Object.keys(scorers).map(scorerId => ({ value: scorerId, label: scorerId }));

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (monitor: Monitor) => {
    setEditing(monitor);
    setDialogOpen(true);
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="flex w-full items-center justify-end">
          <Button variant="primary" onClick={openCreate}>
            Create Monitor
          </Button>
        </div>
      </PageLayout.TopArea>

      {!isLoading && monitors.length === 0 ? (
        <EmptyState
          iconSlot={null}
          titleSlot="No monitors yet"
          descriptionSlot="Monitors watch score aggregates over time and alert a webhook when a threshold is breached."
          actionSlot={
            <Button variant="primary" onClick={openCreate}>
              Create your first monitor
            </Button>
          }
        />
      ) : (
        <MonitorsList monitors={monitors} onEdit={openEdit} onShowEvents={setEventsMonitor} />
      )}

      <MonitorDialog open={dialogOpen} onOpenChange={setDialogOpen} monitor={editing} scorerOptions={scorerOptions} />
      <MonitorEventsDialog monitor={eventsMonitor} onClose={() => setEventsMonitor(undefined)} />
    </PageLayout>
  );
}
