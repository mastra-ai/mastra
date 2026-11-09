import { Button } from '@mastra/playground-ui/components/Button';
import { Drawer, DrawerTrigger } from '@mastra/playground-ui/components/Drawer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsListHeader,
  SettingsNoticeRow,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { Plus, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';

import { useLinkRepositoryMutation, useUnlinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useFactoryEnvironmentQuery } from '../../../../hooks/useFactoryEnvironment';
import { useSidePanelDrawer } from '../../../lib/hooks/useSidePanelDrawer';
import { RepositoriesBlock } from '../../settings/components/environment/RepositoriesBlock';
import type { RepositoryProviders } from '../../settings/components/environment/RepositoriesBlock';
import { useEnvironmentSave } from '../../settings/components/environment/useEnvironmentSave';
import type { FactoryProject } from '../services/github';
import { AddRepositoryPicker } from './AddRepositoryPicker';

export function ConnectRepositoriesPanel({ factory }: { factory: FactoryProject }) {
  const sidePanel = useSidePanelDrawer();
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const linkRepository = useLinkRepositoryMutation();
  const unlinkRepository = useUnlinkRepositoryMutation();
  const environmentQuery = useFactoryEnvironmentQuery(factory.id);
  const { save, disabled: saving } = useEnvironmentSave(factory.id);
  const mutationPending = saving || linkRepository.isPending || unlinkRepository.isPending;
  const providers: RepositoryProviders = Object.fromEntries(
    factory.repositories.map(repository => [repository.projectRepositoryId, repository.provider ?? 'github']),
  );
  const unlinkingId = unlinkRepository.isPending ? unlinkRepository.variables.projectRepositoryId : undefined;
  const repositoryCount = environmentQuery.data?.repositories.length ?? factory.repositories.length;
  const addRepository = (
    <DrawerTrigger
      render={
        <Button ref={addButton} type="button" size="sm" icon={<Plus />} disabled={mutationPending}>
          Add repository
        </Button>
      }
    />
  );

  return (
    <Drawer
      {...sidePanel}
      open={adding}
      onOpenChange={open => {
        if (mutationPending) return;
        if (open) linkRepository.reset();
        setAdding(open);
      }}
    >
      <SettingsContainer aria-label="Factory repositories">
        {repositoryCount === 0 ? (
          <SettingsEmptyRow action={addRepository}>No repositories</SettingsEmptyRow>
        ) : (
          <SettingsListHeader action={addRepository}>
            {repositoryCount === 1 ? '1 repository' : `${repositoryCount} repositories`}
          </SettingsListHeader>
        )}
        {environmentQuery.isPending && (
          <SettingsSkeleton label="Loading repository configuration" variant="item" rows={2} />
        )}
        {environmentQuery.isError && (
          <SettingsNoticeRow>
            <Notice
              variant="destructive"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw />}
                  disabled={environmentQuery.isFetching}
                  onClick={() => void environmentQuery.refetch()}
                >
                  Retry repository configuration
                </Button>
              }
            >
              {environmentQuery.error.message}
            </Notice>
          </SettingsNoticeRow>
        )}
        {environmentQuery.data && (
          <RepositoriesBlock
            repositories={environmentQuery.data.repositories}
            providers={providers}
            disabled={mutationPending || environmentQuery.isError || adding}
            onSave={save}
            onRemove={projectRepositoryId =>
              unlinkRepository.mutate(
                { factoryProjectId: factory.id, projectRepositoryId },
                { onSuccess: () => requestAnimationFrame(() => addButton.current?.focus()) },
              )
            }
            removingId={unlinkingId}
            removeError={
              unlinkRepository.isError
                ? {
                    projectRepositoryId: unlinkRepository.variables.projectRepositoryId,
                    message: unlinkRepository.error.message,
                  }
                : undefined
            }
          />
        )}
      </SettingsContainer>
      {adding && (
        <AddRepositoryPicker
          factory={factory}
          addingRepository={linkRepository.isPending ? linkRepository.variables.repo : undefined}
          linkError={linkRepository.error ?? undefined}
          onAddRepository={repo =>
            linkRepository.mutate(
              { factoryProjectId: factory.id, repo },
              {
                onSuccess: () => {
                  setAdding(false);
                  // The first repository swaps the empty row for the list header, so the drawer's trigger is new.
                  requestAnimationFrame(() => addButton.current?.focus());
                },
              },
            )
          }
        />
      )}
    </Drawer>
  );
}
