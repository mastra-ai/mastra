import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useOverlays } from '../../../lib/overlays';
import { Sidebar } from '../../../Sidebar';
import { PageLayout } from '../../../ui';
import { ChatHeader } from '../../chat/components/ChatHeader';
import { EmptyFactoryState, useActiveFactoryContext } from '../../workspaces';
import type { ServerFactory } from '../../workspaces';
import { isServerFactory, selectRepository, selectedRepository } from '../../workspaces';

interface FactoryPageShellProps {
  title: string;
  description: string;
  /** Renders the page body once a server-backed factory is active. */
  children: (factory: ServerFactory) => ReactNode;
}

/**
 * Shared frame for the Factory pages (Board, Metrics, Audit): the standard app
 * layout (sidebar + mobile header) around a titled content column. Any
 * server-backed Factory renders its pages — including one with zero linked
 * repositories (the pages show connect prompts). Local folder factories get an
 * explanatory notice; when a factory links multiple repositories a picker in
 * the header scopes repository-based intake.
 */
export function FactoryPageShell({ title, description, children }: FactoryPageShellProps) {
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();
  const serverFactory = activeFactory && isServerFactory(activeFactory) ? activeFactory : undefined;

  if (!activeFactory) {
    return <EmptyFactoryState onOpenFactories={() => overlays.open('factories')} />;
  }

  return (
    <PageLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      title={activeFactory ? title : undefined}
      description={activeFactory ? description : undefined}
      actions={serverFactory ? <RepositoryPicker factory={serverFactory} /> : undefined}
    >
      {serverFactory ? (
        children(serverFactory)
      ) : (
        <Notice variant="info">
          Board, metrics, and audit are available for server-backed Factories. This factory is bound to a local folder —
          create a Factory from the switcher to use the Board.
        </Notice>
      )}
    </PageLayout>
  );
}

/**
 * Scopes repository-based feeds (issues, PRs) when the factory links more
 * than one repository. Selection persists on the factory so the Board, chat
 * session, and settings all agree on the active repository.
 */
function RepositoryPicker({ factory }: { factory: ServerFactory }) {
  const queryClient = useQueryClient();
  const repositories = factory.binding.repositories;
  const selected = selectedRepository(factory);
  if (repositories.length < 2 || !selected) return null;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="outline" size="sm" aria-label="Select repository">
            <span className="max-w-48 truncate">{selected.slug}</span>
            <ChevronDown size={13} />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        {repositories.map(repository => (
          <DropdownMenu.Item
            key={repository.projectRepositoryId}
            onSelect={() => {
              selectRepository(factory, repository.projectRepositoryId);
              void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
            }}
          >
            <span className="truncate">{repository.slug}</span>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
