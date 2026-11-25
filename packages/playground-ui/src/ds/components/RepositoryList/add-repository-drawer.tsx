import { useRef } from 'react';
import type { ReactNode } from 'react';

import { RepositoryProviderIcon } from './repository-list';
import type { RepositoryProvider } from './repository-list';
import { Button } from '@/ds/components/Button';
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/ds/components/Drawer';
import { Metadata } from '@/ds/components/Metadata';
import { Notice } from '@/ds/components/Notice';
import { SearchInput } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateClockwise } from '@/ds/icons/central/IconArrowRotateClockwise';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { SettingsItem, SettingsItemIcon, SettingsSkeleton } from '@/ds/new/settings';

export interface AddRepositoryOption {
  /** Unique across providers. */
  key: string;
  fullName: string;
  provider: RepositoryProvider;
  /** Shown as Private/Public when known. */
  private?: boolean;
  defaultBranch?: string | null;
}

export interface AddRepositoryDrawerContentProps {
  /** Already filtered: linked repositories and non-matches removed. */
  repositories: AddRepositoryOption[];
  query: string;
  onQueryChange: (query: string) => void;
  loading?: boolean;
  error?: string;
  /** Extra notices above the list, such as a provider that could not be reached. */
  notices?: ReactNode;
  /** Shown instead of the list when nothing can be searched. */
  unavailableMessage?: ReactNode;
  /** Shown when the list is empty. */
  emptyMessage: ReactNode;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshing?: boolean;
  /** Key of the repository being added; disables the drawer meanwhile. */
  addingKey?: string;
  onAdd: (repository: AddRepositoryOption) => void;
}

/** A drawer body that searches available repositories and adds one. Render inside a `Drawer`. */
export function AddRepositoryDrawerContent({
  repositories,
  query,
  onQueryChange,
  loading,
  error,
  notices,
  unavailableMessage,
  emptyMessage,
  onRefresh,
  refreshLabel = 'Refresh repositories',
  refreshing,
  addingKey,
  onAdd,
}: AddRepositoryDrawerContentProps) {
  const searchInput = useRef<HTMLInputElement>(null);
  const adding = addingKey !== undefined;

  return (
    <DrawerContent
      initialFocus={searchInput}
      showCloseButton={!adding}
      aria-busy={adding || undefined}
      className="overflow-hidden"
    >
      <DrawerHeader className="shrink-0">
        <DrawerTitle>Add repository</DrawerTitle>
        <div className="mt-3 flex items-center gap-2">
          <SearchInput
            label="Search repositories"
            placeholder="Search repositories"
            value={query}
            onValueChange={onQueryChange}
            ref={searchInput}
            disabled={adding}
            className="min-w-0 flex-1"
          />
          {onRefresh && (
            <Button variant="ghost" size="icon-md" aria-label={refreshLabel} onClick={onRefresh} loading={refreshing}>
              <IconArrowRotateClockwise />
            </Button>
          )}
        </div>
      </DrawerHeader>
      <DrawerBody className="min-h-0 overflow-x-hidden overflow-y-auto">
        {error && <Notice variant="destructive">{error}</Notice>}
        {notices}
        {loading ? (
          <SettingsSkeleton label="Loading available repositories" variant="item" rows={3} />
        ) : unavailableMessage ? (
          <Txt as="p" variant="caption" tone="muted">
            {unavailableMessage}
          </Txt>
        ) : (
          <div className="flex flex-col divide-y divide-border *:py-3">
            {repositories.map(repo => (
              <SettingsItem
                key={repo.key}
                media={
                  <SettingsItemIcon>
                    <RepositoryProviderIcon provider={repo.provider} />
                  </SettingsItemIcon>
                }
                title={<span title={repo.fullName}>{repo.fullName}</span>}
                description={
                  <Metadata>
                    {repo.private !== undefined && <Metadata.Item>{repo.private ? 'Private' : 'Public'}</Metadata.Item>}
                    {repo.defaultBranch && <Metadata.Item>Default branch: {repo.defaultBranch}</Metadata.Item>}
                  </Metadata>
                }
              >
                <Button
                  size="sm"
                  icon={<IconPlusMedium />}
                  aria-label={`Add ${repo.fullName}`}
                  disabled={adding}
                  onClick={() => onAdd(repo)}
                  loading={addingKey === repo.key}
                >
                  Add
                </Button>
              </SettingsItem>
            ))}
            {repositories.length === 0 && !error && (
              <Txt as="p" variant="caption" tone="muted">
                {emptyMessage}
              </Txt>
            )}
          </div>
        )}
      </DrawerBody>
      <DrawerFooter className="shrink-0">
        <DrawerClose
          disabled={adding}
          render={
            <Button size="sm" icon={<IconCrossMedium />}>
              Cancel
            </Button>
          }
        />
      </DrawerFooter>
    </DrawerContent>
  );
}
