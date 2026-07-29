import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { GithubPatBlock } from './GithubPatBlock';
import { FactorySetupSection } from './FactorySetupSection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Txt variant="ui-sm">
        {`Connect the code repositories ${activeFactory.name} can edit. This controls code access; sources that create work in Intake are configured separately under Work Intake.`}
      </Txt>

      <ConnectRepositoriesPanel factory={activeFactory} />
      <FactorySetupSection factory={activeFactory} />
      <UserGithubConnectionRow />

      <GithubPatBlock />
    </div>
  );
}
