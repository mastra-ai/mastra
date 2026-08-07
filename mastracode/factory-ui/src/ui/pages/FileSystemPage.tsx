import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { FolderTree } from 'lucide-react';
import { useState } from 'react';

import { useFactoryFsFile, useFactoryFsListing } from '../../hooks/use-factory-fs';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { FactoryFsBrowser } from '../domains/factory-fs/components/FactoryFsBrowser';
import { WorkspaceFileViewer } from '../domains/workspace-viewer/components/WorkspaceFileViewer';

/**
 * The durable factory filesystem (`/factory` in session workspaces), browsable
 * org-wide: the current project's directory is open by default, and the user
 * can navigate up to other projects and the org-wide `shared/` directory.
 */
export function FileSystemPage() {
  return <FactoryPageShell>{factory => <FileSystemContent factoryProjectId={factory.id} />}</FactoryPageShell>;
}

function FileSystemContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const listingQuery = useFactoryFsListing(factoryProjectId);
  const fileQuery = useFactoryFsFile(selectedFilePath);

  if (listingQuery.isError) {
    const message = listingQuery.error instanceof Error ? listingQuery.error.message : 'Unable to load factory files.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  const listing = listingQuery.data;
  if (listing && !listing.available) {
    return (
      <EmptyState
        className="min-h-0 flex-1"
        as="h2"
        iconSlot={<FolderTree className="text-icon3 size-5" aria-hidden />}
        titleSlot="No durable filesystem configured"
        descriptionSlot="This deployment has no durable factory filesystem, so sessions have no /factory mount and there are no files to browse."
      />
    );
  }

  return (
    <section
      className="border-border1 grid min-h-0 flex-1 grid-cols-[minmax(220px,320px)_1fr] overflow-hidden rounded-lg border"
      aria-label="Factory files"
    >
      <div className="border-border1 min-h-0 border-r">
        <FactoryFsBrowser
          entries={listing?.entries ?? []}
          defaultOpenDir={listing?.projectDir}
          selectedFilePath={selectedFilePath}
          isLoading={listingQuery.isPending}
          isRefreshing={listingQuery.isFetching && !listingQuery.isPending}
          error={listingQuery.error ?? undefined}
          onRefresh={() => void listingQuery.refetch()}
          onFileSelect={setSelectedFilePath}
        />
      </div>
      <WorkspaceFileViewer
        filePath={selectedFilePath}
        file={fileQuery.data ? { ...fileQuery.data, workspacePath: '' } : undefined}
        isLoading={fileQuery.isLoading}
        error={fileQuery.error ?? undefined}
        onBack={() => setSelectedFilePath(undefined)}
      />
    </section>
  );
}
