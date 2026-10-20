import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  useConnectSurface,
  useDisconnectUserConnection,
  useUserConnections,
} from '@mastra/playground-ui/domains/connect';
import { useMemo } from 'react';

import { AddConnectionSection } from './components/add-connection-section';
import { ConnectionsList } from './components/connections-list';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/connections')];

const DOCS_URL = 'https://mastra.ai/docs/mastra-platform/connect/end-user-connections';

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

  const connections = useMemo(() => connectionsQuery.data ?? [], [connectionsQuery.data]);
  const globalConnections = useMemo(() => connections.filter(c => c.scope === 'global'), [connections]);
  const userConnections = useMemo(() => connections.filter(c => c.scope === 'user'), [connections]);

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
      <div className="max-w-4xl space-y-8">
        <section aria-label="Your connections" className="space-y-3">
          <Txt as="h2" variant="subheading">
            Your connections
          </Txt>
          {connectionsQuery.isError ? (
            <Txt as="p" variant="body" className="text-destructive-foreground" role="alert">
              {connectionsQuery.error.message}
            </Txt>
          ) : userConnections.length === 0 && !connectionsQuery.isLoading ? (
            <Txt as="p" variant="body" tone="muted">
              You haven't connected any accounts yet.
            </Txt>
          ) : (
            <ConnectionsList
              label="Your connections"
              connections={userConnections}
              onDisconnect={connectionId => disconnect.mutate({ connectionId })}
              disconnectPendingId={disconnect.isPending ? (disconnect.variables?.connectionId ?? null) : null}
            />
          )}
          {disconnect.isError ? (
            <Txt as="p" variant="body" className="text-destructive-foreground" role="alert">
              {disconnect.error.message}
            </Txt>
          ) : null}
        </section>

        <section aria-label="Global connections" className="space-y-3">
          <Txt as="h2" variant="subheading">
            Global connections
          </Txt>
          {connectionsQuery.isError ? (
            // A failed fetch must not masquerade as "no global connections".
            <Txt as="p" variant="body" className="text-destructive-foreground" role="alert">
              {connectionsQuery.error.message}
            </Txt>
          ) : globalConnections.length === 0 && !connectionsQuery.isLoading ? (
            <Txt as="p" variant="body" tone="muted">
              No global connections are linked to this project.
            </Txt>
          ) : (
            <ConnectionsList label="Global connections" connections={globalConnections} />
          )}
        </section>

        <section aria-label="Add a connection" className="space-y-3">
          <Txt as="h2" variant="subheading">
            Add a connection
          </Txt>
          <AddConnectionSection providers={surface.data.providers} />
        </section>
      </div>
    );
  }

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Connections</h1>
      {content}
    </PageLayout>
  );
}
