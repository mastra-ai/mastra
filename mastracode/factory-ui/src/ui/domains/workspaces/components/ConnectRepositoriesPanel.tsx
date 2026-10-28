import { Button } from '@mastra/playground-ui/components/Button';
import { Drawer, DrawerTrigger } from '@mastra/playground-ui/components/Drawer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';

import { useLinkRepositoryMutation, useUnlinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useFactoryEnvironmentQuery } from '../../../../hooks/useFactoryEnvironment';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { RepositoriesBlock } from '../../settings/components/environment/RepositoriesBlock';
import type { RepositoryProviders } from '../../settings/components/environment/RepositoriesBlock';
import { useEnvironmentSave } from '../../settings/components/environment/useEnvironmentSave';
import { SettingsAddRow } from '../../settings/components/common/SettingsAddRow';
import type { FactoryProject } from '../services/github';
import { AddRepositoryPicker } from './AddRepositoryPicker';

export function ConnectRepositoriesPanel({ factory }: { factory: FactoryProject }) {
  const isMobile = useIsMobile();
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

  return (
    <Drawer
      side={isMobile ? 'bottom' : 'right'}
      variant={isMobile ? 'default' : 'floating'}
      overlay="visible"
      open={adding}
      onOpenChange={open => {
        if (mutationPending) return;
        if (open) linkRepository.reset();
        setAdding(open);
      }}
    >
      <SettingsContainer aria-label="Factory repositories" className="overflow-hidden">
        {environmentQuery.isPending && <SkeletonRows label="Loading repository configuration" rows={2} />}
        {environmentQuery.isError && (
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
        <DrawerTrigger
          render={
            <SettingsAddRow ref={addButton} disabled={mutationPending}>
              Add repository
            </SettingsAddRow>
          }
        />
      </SettingsContainer>
      {adding && (
        <AddRepositoryPicker
          factory={factory}
          addingRepository={linkRepository.isPending ? linkRepository.variables.repo : undefined}
          linkError={linkRepository.error ?? undefined}
          onAddRepository={repo =>
            linkRepository.mutate({ factoryProjectId: factory.id, repo }, { onSuccess: () => setAdding(false) })
          }
        />
      )}
    </Drawer>
  );
}
