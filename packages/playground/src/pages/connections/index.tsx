import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import {
  useConnectSurface,
  useDisconnectUserConnection,
  useUserConnections,
} from '@mastra/playground-ui/domains/connect';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlusIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { AddConnectionDialog } from './components/add-connection-dialog';
import { ConnectionsTable } from './components/connections-table';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/connections')];

const DOCS_URL = 'https://mastra.ai/docs/mastra-platform/connect/end-user-connections';

function fetchErrorNotice(message: string) {
  return (
    <div role="alert">
      <Notice variant="destructive" title="Couldn't load connections">
        <Notice.Message>{message}</Notice.Message>
      </Notice>
    </div>
  );
}

function docsLink(label: string) {
  return (
    <a href={DOCS_URL} target="_blank" rel="noreferrer" className="text-ui-md underline underline-offset-2">
      {label}
    </a>
  );
}

/**
 * End-user connections for the dev server's mounted `userConnectRoutes()`
 * surface: the project's global connections plus the connections belonging to
 * the resource key the studio session resolves to.
 */
export default function ConnectionsPage() {
  const surface = useConnectSurface();
  const connectionsQuery = useUserConnections({ enabled: surface.data?.status === 'ready' });
  const disconnect = useDisconnectUserConnection();
  const [addOpen, setAddOpen] = useState(false);

  const { mutate: disconnectMutate } = disconnect;
  const handleDisconnect = useCallback(
    (connectionId: string, displayName: string) => {
      disconnectMutate(
        { connectionId },
        {
          onSuccess: () => toast.success(`Disconnected ${displayName}`),
          onError: error => toast.error(error.message),
        },
      );
    },
    [disconnectMutate],
  );

  const connections = useMemo(() => connectionsQuery.data ?? [], [connectionsQuery.data]);
  const globalConnections = useMemo(() => connections.filter(c => c.scope === 'global'), [connections]);
  const userConnections = useMemo(() => connections.filter(c => c.scope === 'user'), [connections]);
  const surfaceData = surface.data;
  const providers = useMemo(() => (surfaceData?.status === 'ready' ? surfaceData.providers : []), [surfaceData]);
  const providersById = useMemo(() => new Map(providers.map(provider => [provider.id, provider])), [providers]);

  let content: React.ReactNode;

  if (surface.isLoading) {
    content = (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  } else if (surface.isError) {
    content = (
      <EmptyState
        tone="error"
        variant="fill"
        titleSlot="Failed to load connections"
        descriptionSlot={surface.error.message}
      />
    );
  } else if (surface.data?.status === 'not-mounted') {
    content = (
      <EmptyState
        variant="fill"
        titleSlot="Connect routes are not mounted"
        descriptionSlot="Mount userConnectRoutes() from @mastra/connect in server.apiRoutes to let your users connect their own accounts."
        actionSlot={docsLink('Read the end-user connections docs')}
      />
    );
  } else if (surface.data?.status === 'unauthenticated') {
    content = (
      <EmptyState
        variant="fill"
        titleSlot="No end-user identity"
        descriptionSlot="End-user connections need an authenticated user. Configure server.auth with mapUserToResourceId so studio sessions resolve to a resource key."
        actionSlot={docsLink('Read the end-user connections docs')}
      />
    );
  } else if (surface.data?.status === 'ready') {
    content = (
      <div className="mt-6 flex flex-col gap-6 pb-16">
        {connectionsQuery.isError ? (
          fetchErrorNotice(connectionsQuery.error.message)
        ) : (
          <ConnectionsTable
            globalConnections={globalConnections}
            userConnections={userConnections}
            providersById={providersById}
            loading={connectionsQuery.isLoading}
            onDisconnect={handleDisconnect}
            disconnectPendingId={disconnect.isPending ? (disconnect.variables?.connectionId ?? null) : null}
          />
        )}

        <AddConnectionDialog providers={providers} open={addOpen} onOpenChange={setAddOpen} />
      </div>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>Connections</PageHeader.Title>
          {surface.data?.status === 'ready' ? (
            <PageHeader.Action>
              <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                <PlusIcon aria-hidden /> Add connection
              </Button>
            </PageHeader.Action>
          ) : null}
        </PageHeader>
      }
    >
      {content}
    </PageLayout>
  );
}
