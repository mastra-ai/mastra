import { useRouteFactory } from '../../../../../shared/hooks/useRouteFactory';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useOverlays } from '../../../lib/overlays';
import { EmptyFactoryState, useGithubStatusQuery } from '../../workspaces';
import type { ServerFactory } from '../../workspaces';
import { isServerFactory } from '../../workspaces';

interface FactoryPageShellProps {
  title: string;
  description: string;
  /** Renders the page body once a GitHub-backed factory is active. */
  children: (factory: ServerFactory) => ReactNode;
}

/**
 * Shared frame for the Factory pages (the Board): the standard app
 * layout (sidebar + mobile header) around a titled content column. Factory data
 * comes from GitHub, so local factories and disconnected GitHub states get an
 * explanatory notice instead of a broken empty list.
 */
export function FactoryPageShell({ title, description, children }: FactoryPageShellProps) {
  const overlays = useOverlays();
  const { activeFactory } = useRouteFactory();
  const githubFactory = activeFactory && isServerFactory(activeFactory) ? activeFactory : undefined;
  const status = useGithubStatusQuery(Boolean(githubFactory));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 md:px-4 md:py-5">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        {activeFactory ? (
          <header className="flex flex-col gap-1">
            <h1 className="m-0 text-xl text-icon6">{title}</h1>
            <p className="m-0 text-ui-sm text-icon3">{description}</p>
          </header>
        ) : null}
        {activeFactory ? (
          !githubFactory ? (
            <Notice variant="info">
              Board, metrics, and audit require a Factory connected to GitHub. Switch to a GitHub-backed factory.
            </Notice>
          ) : status.isPending ? null : status.data?.enabled && status.data.connected ? (
            children(githubFactory)
          ) : (
            <Notice variant="info">
              {title} requires a Factory connected to GitHub. Connect GitHub from the factories menu to see issues and
              pull requests.
            </Notice>
          )
        ) : (
          <EmptyFactoryState onOpenFactories={() => overlays.open('factories')} />
        )}
      </div>
    </div>
  );
}
