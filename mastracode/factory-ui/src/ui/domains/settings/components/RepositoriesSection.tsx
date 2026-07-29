import { Notice } from '@mastra/playground-ui/components/Notice';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { GithubPatBlock } from './GithubPatBlock';
import { FactorySetupSection } from './FactorySetupSection';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        title="Repositories"
        description={`Repositories ${activeFactory.name} can edit. What feeds the board is set under Work Intake.`}
      >
        <ConnectRepositoriesPanel factory={activeFactory} />
      </SettingsSubsection>

      <FactorySetupSection factory={activeFactory} />

      <UserGithubConnectionRow />

      <GithubPatBlock />
    </div>
  );
}
