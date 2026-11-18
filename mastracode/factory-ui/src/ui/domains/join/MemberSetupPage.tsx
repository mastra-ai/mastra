import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { useEffect } from 'react';

import { useChannelAccountsQuery } from '../../../hooks/useChannelAccounts';
import { useActiveFactory } from '../workspaces/components/FactoryLayout';
import { SetupFlow } from './components/SetupFlow';
import { SetupLayout } from './components/SetupLayout';
import { useMemberModelStep } from './hooks/useMemberModelStep';
import { markMemberSetupSeen } from './services/memberSetup';

/**
 * `/factories/:factoryId/setup`: what a member still needs before they can work in this Factory. It opens by
 * itself on the first visit to a Factory with a step left, and Slack's "Connect" and "Finish setup" cards end
 * here. The steps:
 *   - Model, when sessions run on personal accounts (`user`, or `hybrid` for sessions) and the member has none.
 *   - Slack, optional, when "Sign in with Slack" is configured and the member has not linked their account.
 */
export function MemberSetupPage() {
  const factory = useActiveFactory();
  const model = useMemberModelStep(factory.id);
  const channels = useChannelAccountsQuery();

  useEffect(() => markMemberSetupSeen(factory.id), [factory.id]);

  if (!model.settled || channels.isPending) {
    return (
      <SetupLayout factoryName={factory.name}>
        <div className="grid min-h-60 place-items-center">
          <BrandLoader size="lg" aria-label="Loading setup" />
        </div>
      </SetupLayout>
    );
  }
  return <SetupFlow factory={factory} needsModel={model.needsModel} channels={channels.data} />;
}
