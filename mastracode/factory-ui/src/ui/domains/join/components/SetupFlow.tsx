import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { ChannelAccountsPayload } from '../../settings/services/channelAccounts';
import { StepDoneRow, StepNextRow } from '../../workspaces/components/onboarding/OnboardingStepRow';
import type { FactoryModelScope, FactoryProject } from '../../workspaces/services/github';
import { slackAccountLabel, slackOrigin } from '../services/memberSetup';
import { ModelStep } from './ModelStep';
import { SetupComplete } from './SetupComplete';
import { SetupLayout } from './SetupLayout';
import { SetupVisual } from './SetupVisual';
import { SlackStep } from './SlackStep';

type Stage = 'model' | 'slack' | 'done';

interface SetupSteps {
  model: boolean;
  slack: boolean;
}

function firstStage(steps: SetupSteps): Stage {
  if (steps.model) return 'model';
  if (steps.slack) return 'slack';
  return 'done';
}

/**
 * The member's steps, fixed when the page first knows them: connecting a provider changes what the queries say,
 * and that must not pull the lane out from under the member before they press Continue. Coming from Slack, the
 * page ends with the way back to the thread.
 */
export function SetupFlow({
  factory,
  needsModel,
  channels,
}: {
  factory: FactoryProject;
  needsModel: boolean;
  channels: ChannelAccountsPayload | undefined;
}) {
  const [params] = useSearchParams();
  const origin = slackOrigin(params);
  const slackFailed = params.get('slack') === 'error';
  const slackAccount = channels?.accounts.find(account => account.platform === 'slack');
  const [steps] = useState<SetupSteps>(() => ({
    model: needsModel,
    // Coming from Slack the member is linked, unless that sign-in just failed.
    slack: !slackAccount && Boolean(channels?.canConnect) && (!origin || slackFailed),
  }));
  const [stage, setStage] = useState(() => firstStage(steps));
  const modelScope: FactoryModelScope = factory.modelScope ?? 'factory';
  const personal = modelScope !== 'factory';
  const auth = useFactoryAuth();
  const personalDefault = useDefaultModelQuery({ enabled: personal });
  const account = auth.data?.user?.email ?? 'Your account';
  const modelId = personal ? (personalDefault.data?.modelId ?? undefined) : undefined;
  const visual = <SetupVisual factoryId={factory.id} modelScope={modelScope} />;

  if (stage === 'done') {
    return (
      <SetupLayout factoryName={factory.name} visual={visual}>
        <SetupComplete
          factoryId={factory.id}
          origin={origin}
          account={account}
          modelId={modelId}
          slackAccount={slackAccount}
        />
      </SetupLayout>
    );
  }

  const linkedFromSlack = origin && slackAccount;
  // Account, then Slack when the member arrived through it, then the steps left.
  const modelIndex = linkedFromSlack ? 3 : 2;
  const slackIndex = modelIndex + (steps.model ? 1 : 0);
  return (
    <SetupLayout factoryName={factory.name} visual={visual}>
      <Txt as="h1" variant="display">
        {origin ? 'Finish setting up Slack' : `Welcome to ${factory.name}`}
      </Txt>
      <Txt as="p" variant="body" tone="muted" className="mb-4">
        {origin
          ? 'One more step and the agent can pick up your messages. Then mention it again in your thread.'
          : 'Connect your own model so you can start sessions here and from Slack.'}
      </Txt>
      {slackFailed && (
        <Notice variant="destructive" className="mb-2">
          Slack sign-in didn&apos;t finish. Try again below.
        </Notice>
      )}
      <StepDoneRow label="Account" value={account} subValue={`Signed in to ${factory.name}`} />
      {linkedFromSlack && <StepDoneRow label="Slack" value={slackAccountLabel(linkedFromSlack)} subValue="Linked" />}
      {steps.model && stage === 'model' && (
        <ModelStep
          index={modelIndex}
          modelScope={modelScope}
          onSaved={() => setStage(steps.slack ? 'slack' : 'done')}
        />
      )}
      {steps.model && stage !== 'model' && (
        <StepDoneRow label="Model" value={modelId ?? 'Connected'} subValue="Your own account" />
      )}
      {steps.slack && stage === 'slack' && (
        <SlackStep index={slackIndex} factoryId={factory.id} onSkip={() => setStage('done')} />
      )}
      {steps.slack && stage !== 'slack' && <StepNextRow index={slackIndex} label="Slack" hint="Optional" />}
      <Link
        to={`/factories/${factory.id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mt-2 self-start' })}
      >
        Skip for now
      </Link>
    </SetupLayout>
  );
}
