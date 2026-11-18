import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useApiConfig } from '../../../api/config';
import { useDefaultModelQuery, useSetDefaultModel } from '../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../hooks/use-providers';
import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../hooks/useFactoryDefaultModel';
import { credentialAt } from '../settings/components/provider-credential';
import { connectSlackUrl } from '../settings/services/channelAccounts';
import type { ConnectedChannelAccount } from '../settings/services/channelAccounts';
import { useActiveFactory } from '../workspaces/components/FactoryLayout';
import { OnboardingAccountMenu } from '../workspaces/components/onboarding/OnboardingAccountMenu';
import { OnboardingInset } from '../workspaces/components/onboarding/OnboardingInset';
import { OnboardingPreview } from '../workspaces/components/onboarding/preview/OnboardingPreview';
import '../workspaces/components/onboarding/onboarding.css';
import type { OnboardingDraftModel, OnboardingModelScope } from '../workspaces/services/onboardingFlow';
import { PersonalModelLane, usePersonalModelLane } from './components/PersonalModelLane';
import type { PersonalModelLaneState } from './components/PersonalModelLane';
import { SetupDoneRow, SetupNextRow, SetupStepCard } from './components/SetupSteps';
import { useMemberSetup } from './hooks/useMemberSetup';
import type { MemberSetup } from './hooks/useMemberSetup';
import { markMemberSetupSeen, personalLaneSelection, slackClientUrl } from './services/memberSetup';

type Stage = 'model' | 'slack' | 'done';

/** Where the member came from: Slack's "Connect" or "Finish setup" card, with the workspace and channel to go back to. */
interface SlackOrigin {
  teamId: string | null;
  channelId: string | null;
}

/**
 * `/factories/:factoryId/setup`: what a member still needs before they can work in this Factory. It opens by
 * itself on the first visit to a Factory with a step left, and Slack's "Connect" and "Finish setup" cards end
 * here. The steps:
 *   - Model, when sessions run on personal accounts (`user`, or `hybrid` for sessions) and the member has none.
 *   - Slack, optional, when "Sign in with Slack" is configured and the member has not linked their account.
 * Coming from Slack, the page ends with the way back to the thread.
 */
export function MemberSetupPage() {
  const factory = useActiveFactory();
  const setup = useMemberSetup(factory.id);

  useEffect(() => markMemberSetupSeen(factory.id), [factory.id]);

  if (!setup.settled) {
    return (
      <SetupLayout factoryName={factory.name}>
        <div className="grid min-h-60 place-items-center">
          <BrandLoader size="lg" aria-label="Loading setup" />
        </div>
      </SetupLayout>
    );
  }
  return <SetupFlow factoryId={factory.id} factoryName={factory.name} setup={setup} />;
}

function SetupLayout({
  factoryName,
  visual,
  children,
}: {
  factoryName: string;
  visual?: ReactNode;
  children: ReactNode;
}) {
  const showVisual = !useIsMobile(900);
  return (
    <div className="bg-background text-foreground min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoWithoutText className="w-6" aria-hidden="true" />
            <Txt as="span" variant="label">
              {factoryName}
            </Txt>
          </div>
          <OnboardingAccountMenu />
        </header>
        <main className="mx-auto flex w-full max-w-[520px] flex-col gap-2 px-4 pt-6 pb-6 min-[900px]:px-5">
          {children}
        </main>
        <Txt as="p" variant="meta" tone="muted" className="mt-auto px-6 pt-2 pb-32 min-[900px]:pb-5">
          You can change your model and connected accounts anytime in Settings.
        </Txt>
      </div>
      {showVisual && visual && (
        <div className="sticky top-0 h-dvh p-2">
          <div className="onboarding-card bg-card rounded-studio-frame h-full overflow-hidden p-px">{visual}</div>
        </div>
      )}
    </div>
  );
}

/**
 * The steps, fixed when the page first knows them: connecting a provider changes what the queries say, and
 * that must not pull the lane out from under the member before they press Continue.
 */
function SetupFlow({ factoryId, factoryName, setup }: { factoryId: string; factoryName: string; setup: MemberSetup }) {
  const [params] = useSearchParams();
  const slackStatus = params.get('slack');
  const origin: SlackOrigin | undefined =
    params.get('from') === 'slack' ? { teamId: params.get('team'), channelId: params.get('channel') } : undefined;
  const auth = useFactoryAuth();
  const providers = useProvidersQuery();
  const personalDefault = useDefaultModelQuery();
  const [steps] = useState(() => ({
    model: setup.model === 'needed',
    // Coming from Slack the member is linked, unless that sign-in just failed.
    slack: setup.slack === 'needed' && (!origin || slackStatus === 'error'),
  }));
  const [stage, setStage] = useState<Stage>(steps.model ? 'model' : steps.slack ? 'slack' : 'done');
  const [savedModelId, setSavedModelId] = useState<string>();
  const lane = usePersonalModelLane(personalLaneSelection(providers.data, personalDefault.data?.modelId));
  const modelScope: OnboardingModelScope = setup.modelScope ?? 'hybrid';
  const email = auth.data?.user?.email ?? auth.data?.user?.name ?? 'Your account';
  const modelId = savedModelId ?? personalDefault.data?.modelId ?? undefined;
  const visual = <SetupVisual factoryId={factoryId} modelScope={modelScope} personal={lane.lane.choice} />;

  if (stage === 'done') {
    return (
      <SetupLayout factoryName={factoryName} visual={visual}>
        <SetupComplete
          factoryId={factoryId}
          origin={origin}
          email={email}
          modelId={setup.model === 'none' ? undefined : modelId}
          slackAccount={setup.slackAccount}
        />
      </SetupLayout>
    );
  }

  const linkedFromSlack = origin && setup.slack === 'done';
  // Account, then Slack when the member arrived through it, then the steps left.
  const modelIndex = linkedFromSlack ? 3 : 2;
  const slackIndex = modelIndex + (steps.model ? 1 : 0);
  return (
    <SetupLayout factoryName={factoryName} visual={visual}>
      <Txt as="h1" variant="display">
        {origin ? 'Finish setting up Slack' : `Welcome to ${factoryName}`}
      </Txt>
      <Txt as="p" variant="body" tone="muted" className="mb-4">
        {origin
          ? 'One more step and the agent can pick up your messages. Then mention it again in your thread.'
          : 'Connect your own model so you can start sessions here and from Slack.'}
      </Txt>
      {slackStatus === 'error' && (
        <Notice variant="destructive" className="mb-2">
          Slack sign-in didn&apos;t finish. Try again below.
        </Notice>
      )}
      <SetupDoneRow label="Account" value={email} subValue={`Signed in to ${factoryName}`} />
      {linkedFromSlack && <SlackDoneRow account={setup.slackAccount} />}
      {steps.model &&
        (stage === 'model' ? (
          <ModelStep
            index={modelIndex}
            modelScope={modelScope}
            lane={lane}
            onSaved={id => {
              setSavedModelId(id);
              setStage(steps.slack ? 'slack' : 'done');
            }}
          />
        ) : (
          <SetupDoneRow label="Model" value={modelId ?? 'Connected'} subValue="Your own account" />
        ))}
      {steps.slack &&
        (stage === 'slack' ? (
          <SlackStep index={slackIndex} factoryId={factoryId} onSkip={() => setStage('done')} />
        ) : (
          <SetupNextRow index={slackIndex} label="Slack" hint="Mention the agent as yourself" optional />
        ))}
      <Link
        to={`/factories/${factoryId}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mt-2 self-start' })}
      >
        Skip for now
      </Link>
    </SetupLayout>
  );
}

function slackAccountLabel(account: ConnectedChannelAccount): string {
  return `@${account.externalUserName ?? account.externalUserId} in ${account.externalTeamName ?? account.externalTeamId}`;
}

function SlackDoneRow({ account }: { account: ConnectedChannelAccount | undefined }) {
  if (!account) return null;
  return <SetupDoneRow label="Slack" value={slackAccountLabel(account)} subValue="Linked" />;
}

function ModelStep({
  index,
  modelScope,
  lane,
  onSaved,
}: {
  index: number;
  modelScope: OnboardingModelScope;
  lane: PersonalModelLaneState;
  onSaved: (modelId: string) => void;
}) {
  const setDefault = useSetDefaultModel();
  const choice = lane.lane.choice;
  return (
    <SetupStepCard
      index={index}
      label="Your model"
      notice={
        <Txt as="p" variant="caption" tone="muted" className="px-3 pb-2">
          {modelScope === 'hybrid'
            ? 'Board work runs on the company account. Your chats and the Slack threads you start run on your own account, so connect one to get going.'
            : 'Sessions in this Factory run on your own account, so connect one to get going.'}
        </Txt>
      }
      note="Takes about a minute"
      primary={
        <Button
          variant="primary"
          size="lg"
          disabled={!choice || setDefault.isPending}
          onClick={() => {
            if (!choice) return;
            // The lane saved the credential already; the model becomes the personal default sessions start on.
            setDefault.mutate(choice.modelId, { onSuccess: () => onSaved(choice.modelId) });
          }}
        >
          {setDefault.isPending ? 'Saving…' : 'Continue'}
        </Button>
      }
    >
      <PersonalModelLane modelScope={modelScope} state={lane} />
      {setDefault.isError && (
        <Notice variant="destructive" className="mx-1">
          Couldn&apos;t save your default model. {setDefault.error.message}
        </Notice>
      )}
    </SetupStepCard>
  );
}

function SlackStep({ index, factoryId, onSkip }: { index: number; factoryId: string; onSkip: () => void }) {
  const { baseUrl } = useApiConfig();
  return (
    <SetupStepCard
      index={index}
      label="Slack"
      headerEnd={
        <Txt as="span" variant="meta" tone="muted" className="bg-fill rounded-full px-2 py-0.5">
          Optional
        </Txt>
      }
      primary={
        <Button variant="ghost" size="lg" onClick={onSkip}>
          Not now
        </Button>
      }
      note="You can link it later from Slack itself"
    >
      <OnboardingInset className="p-3">
        <div className="flex items-center gap-3">
          <span className="bg-card grid size-9 shrink-0 place-items-center rounded-lg">
            <SlackIcon className="size-icon-lg" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <Txt as="span" variant="label">
              Link your Slack account
            </Txt>
            <Txt as="span" variant="caption" tone="muted">
              Mention the agent in Slack and it runs as you, on your model.
            </Txt>
          </div>
          <Button onClick={() => window.location.assign(connectSlackUrl(baseUrl, factoryId, 'setup'))}>
            <SlackIcon className="size-icon-sm" aria-hidden="true" />
            Sign in with Slack
          </Button>
        </div>
      </OnboardingInset>
    </SetupStepCard>
  );
}

/** Onboarding's routing diagram: the company lane from the Factory's default, the member's from their pick. */
function SetupVisual({
  factoryId,
  modelScope,
  personal,
}: {
  factoryId: string;
  modelScope: OnboardingModelScope;
  personal: OnboardingDraftModel | undefined;
}) {
  const project = useFactoryProjectQuery(factoryId);
  const providers = useProvidersQuery();
  const companyModel = project.data?.defaultModelId ?? undefined;
  const companyProvider = companyModel?.split('/')[0];
  const companyInfo = providers.data?.find(provider => provider.provider === companyProvider);
  return (
    <OnboardingPreview
      step="model"
      modelScope={modelScope}
      providerId={companyProvider}
      connectionMethod={companyInfo ? credentialAt(companyInfo, 'org') : undefined}
      model={companyModel}
      personalProviderId={personal?.providerId}
      personalConnectionMethod={personal?.method}
      personalModel={personal?.modelId || undefined}
    />
  );
}

function SetupComplete({
  factoryId,
  origin,
  email,
  modelId,
  slackAccount,
}: {
  factoryId: string;
  origin: SlackOrigin | undefined;
  email: string;
  modelId: string | undefined;
  slackAccount: ConnectedChannelAccount | undefined;
}) {
  return (
    <div className="onboarding-reveal flex flex-col gap-6 pt-[8vh]">
      <span className="bg-foreground text-background grid size-12 place-items-center rounded-full" aria-hidden="true">
        <IconCheckmark2Medium className="size-icon-lg" />
      </span>
      <div className="flex flex-col gap-3">
        <Txt as="h1" variant="display">
          You&apos;re all set
        </Txt>
        <Txt as="p" variant="body" tone="muted">
          {origin
            ? 'Mention the agent again in your Slack thread and it picks up from there.'
            : 'Start a session, or pick up a card from the board.'}
        </Txt>
      </div>
      <div className="onboarding-card bg-card flex flex-col gap-1 rounded-2xl p-1">
        <SummaryRow label="Account" value={email} />
        {modelId && <SummaryRow label="Model" value={modelId} />}
        {slackAccount && <SummaryRow label="Slack" value={slackAccountLabel(slackAccount)} />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {origin ? (
          <>
            <a
              href={slackClientUrl(origin.teamId ?? slackAccount?.externalTeamId, origin.channelId)}
              className={buttonVariants({ variant: 'primary', size: 'lg' })}
            >
              <SlackIcon className="size-icon-sm" aria-hidden="true" />
              Back to Slack
            </a>
            <Link to={`/factories/${factoryId}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              Open the board
            </Link>
          </>
        ) : (
          <>
            <Link to={`/factories/${factoryId}/new`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Start a session
            </Link>
            <Link to={`/factories/${factoryId}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              Go to the board
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <span
        className="bg-foreground text-background grid size-5 shrink-0 place-items-center rounded-full"
        aria-hidden="true"
      >
        <IconCheckmark2Medium className="size-icon-xs" />
      </span>
      <Txt as="span" tone="muted" className="w-20 shrink-0">
        {label}
      </Txt>
      <Txt as="span" tone="ink" className="truncate">
        {value}
      </Txt>
    </div>
  );
}
