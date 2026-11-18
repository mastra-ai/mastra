import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { settingsSectionPath } from '../settingsSections';
import { GithubPatBlock } from './GithubPatBlock';
import { SettingsSubsection } from './SettingsSubsection';
import { SourceControlConnections } from './SourceControlConnections';
import { SettingsListSkeleton } from './common/SettingsListSkeleton';

function addedDescription(factoryName: string): string {
  return `Repositories agents in ${factoryName} can edit. Pre-cloned repositories are set up in this order.`;
}

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const githubConnected = useGithubStatusQuery().data?.connected === true;
  const activeFactory = factoryQuery.data;

  if (factoryQuery.isLoading) {
    return (
      <>
        <SourceControlConnections />
        <SettingsSubsection
          scope="factory"
          title="Added to this Factory"
          description={addedDescription('this Factory')}
        >
          <SettingsListSkeleton label="Loading repositories" rows={2} />
        </SettingsSubsection>
      </>
    );
  }
  if (factoryQuery.isError && !activeFactory) {
    return <Notice variant="destructive">{factoryQuery.error.message}</Notice>;
  }
  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  const githubRelevant =
    githubConnected || activeFactory.repositories.some(repository => repository.provider !== 'gitlab');

  return (
    <>
      <SourceControlConnections />

      <SettingsSubsection
        scope="factory"
        title="Added to this Factory"
        description={addedDescription(activeFactory.name)}
      >
        <ConnectRepositoriesPanel key={activeFactory.id} factory={activeFactory} />
      </SettingsSubsection>

      {githubRelevant && <GithubPatBlock />}

      <Txt as="p" variant="meta" tone="muted" className="ps-2.5">
        Configure sandbox resources and workspace setup in{' '}
        <Link to={settingsSectionPath(activeFactory.id, 'factory')} className="underline">
          Manage Factory
        </Link>
        .
      </Txt>
    </>
  );
}
