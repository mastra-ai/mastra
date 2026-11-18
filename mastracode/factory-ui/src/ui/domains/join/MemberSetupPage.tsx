import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link, useSearchParams } from 'react-router';

import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { OnboardingAccountMenu } from '../workspaces/components/onboarding/OnboardingAccountMenu';
import { OnboardingInset } from '../workspaces/components/onboarding/OnboardingInset';
import { OnboardingPreview } from '../workspaces/components/onboarding/preview/OnboardingPreview';
import { useActiveFactory } from '../workspaces/components/FactoryLayout';
import { useFactoryProjectQuery } from '../../../hooks/useFactoryDefaultModel';
import '../workspaces/components/onboarding/onboarding.css';
import { PersonalModelLane } from './components/PersonalModelLane';
import { SetupDoneRow, SetupNextRow, SetupStepCard } from './components/SetupSteps';

type SetupStep = 'model' | 'slack' | 'done';

/** Where the member came from. A Slack origin carries the message that is waiting for them. */
interface SlackOrigin {
  channel: string;
  agent: string;
  message: string;
}

function readSlackOrigin(params: URLSearchParams): SlackOrigin | undefined {
  if (params.get('from') !== 'slack') return undefined;
  return {
    channel: params.get('channel') ?? 'eng-factory',
    agent: params.get('agent') ?? 'Shipyard',
    message: params.get('message') ?? 'can you check why the preview deploy is failing on main?',
  };
}

/**
 * `/factories/:factoryId/setup` — what a member (not the creator) needs before they can work in this Factory.
 * Every entry point lands here: the invite link, the first visit to a factory with steps left, the "No model"
 * wall, and Slack's "Finish setup" card. The steps come from the factory's routing and the member's state:
 *   - Model, when chats run on personal keys (scope `user` or `hybrid`) and the member has none.
 *   - Slack, when the factory has Slack and the member has no link for that workspace.
 * A Slack origin puts Slack first (the user is mid-conversation) and ends with "Back to Slack".
 */
export function MemberSetupPage() {
  const factory = useActiveFactory();
  const project = useFactoryProjectQuery(factory.id);
  const auth = useFactoryAuth();
  const [params] = useSearchParams();
  const showVisual = !useIsMobile(900);
  const slack = readSlackOrigin(params);
  const step: SetupStep = (params.get('step') as SetupStep | null) ?? 'model';
  const modelScope = project.data?.modelScope ?? 'hybrid';
  const email = auth.data?.user?.email ?? 'ward@mastra.ai';
  const orgName = 'Kepler';
  const modelDone = step === 'done' || (step === 'slack' && !slack);
  // Prototype: the lane reports readiness in the real page (a connected provider plus a resolved model).
  const ready = params.get('ready') === '1';

  return (
    <div className="bg-background text-foreground min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoWithoutText className="w-6" aria-hidden="true" />
            <Txt as="span" variant="label">
              {factory.name}
            </Txt>
          </div>
          <OnboardingAccountMenu />
        </header>
        <main className="mx-auto flex w-full max-w-[520px] flex-col gap-2 px-4 pt-6 pb-6 min-[900px]:px-5">
          {step === 'done' ? (
            <SetupComplete factoryId={factory.id} slack={slack} email={email} />
          ) : (
            <>
              <Txt as="h1" variant="display">
                {slack ? `Finish setting up ${slack.agent}` : `Welcome to ${factory.name}`}
              </Txt>
              <Txt as="p" variant="body" tone="muted" className="mb-4">
                {slack
                  ? `One last step and ${slack.agent} picks up your message. You won't need to send it again.`
                  : `${orgName} added you to this Factory. Connect your model so you can start sessions here and from Slack.`}
              </Txt>
              {slack && <SlackOriginCard origin={slack} />}
              <SetupDoneRow label="Account" value={email} subValue={`Member of ${orgName}`} />
              {slack ? (
                <>
                  <SetupDoneRow label="Slack" value="Kepler · @ward" subValue="Linked just now" />
                  <ModelStep index={3} modelScope={modelScope} ready={ready} primaryLabel={`Send to ${slack.agent}`} />
                </>
              ) : step === 'model' ? (
                <>
                  <ModelStep index={2} modelScope={modelScope} ready={ready} primaryLabel="Continue" />
                  <SetupNextRow index={3} label="Slack" hint="Mention @Shipyard as yourself" optional />
                </>
              ) : (
                <>
                  {modelDone && (
                    <SetupDoneRow label="Model" value="Claude Opus 5.5" subValue="Your Claude subscription" />
                  )}
                  <SlackStep index={3} factoryId={factory.id} />
                </>
              )}
            </>
          )}
        </main>
        <Txt as="p" variant="meta" tone="muted" className="mt-auto px-6 pt-2 pb-32 min-[900px]:pb-5">
          You can change your model and connected accounts anytime in Settings.
        </Txt>
      </div>
      {showVisual && (
        <div className="sticky top-0 h-dvh p-2">
          <div className="onboarding-card bg-card rounded-studio-frame h-full overflow-hidden p-px">
            <OnboardingPreview
              step="model"
              modelScope={modelScope}
              providerId="anthropic"
              connectionMethod="api_key"
              model="anthropic/claude-opus-5-5"
              personalProviderId={step === 'model' && !slack ? undefined : 'anthropic'}
              personalConnectionMethod="oauth"
              personalModel={step === 'model' && !slack ? undefined : 'anthropic/claude-opus-5-5'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModelStep({
  index,
  modelScope,
  ready,
  primaryLabel,
}: {
  index: number;
  modelScope: 'factory' | 'user' | 'hybrid';
  ready: boolean;
  primaryLabel: string;
}) {
  return (
    <SetupStepCard
      index={index}
      label="Your model"
      notice={
        modelScope === 'hybrid' ? (
          <Txt as="p" variant="caption" tone="muted" className="px-3 pb-2">
            Board work runs on the company account. Your chats and the Slack threads you start run on your own account,
            so connect one to get going.
          </Txt>
        ) : undefined
      }
      note="Takes about a minute"
      primary={
        <Button variant="primary" size="lg" disabled={!ready}>
          {primaryLabel}
        </Button>
      }
    >
      <PersonalModelLane
        modelScope={modelScope}
        initial={ready ? { providerId: 'anthropic', method: 'oauth', modelId: 'anthropic/claude-opus-5-5' } : undefined}
      />
    </SetupStepCard>
  );
}

function SlackStep({ index, factoryId }: { index: number; factoryId: string }) {
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
        <Link to={`/factories/${factoryId}`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          Finish
        </Link>
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
              Mention @Shipyard in Kepler&apos;s Slack and it runs as you, on your model.
            </Txt>
          </div>
          <Button>
            <SlackIcon className="size-icon-sm" aria-hidden="true" />
            Sign in with Slack
          </Button>
        </div>
      </OnboardingInset>
    </SetupStepCard>
  );
}

function SlackOriginCard({ origin }: { origin: SlackOrigin }) {
  return (
    <OnboardingInset className="border-border mb-3 gap-2 border p-3">
      <div className="flex items-center gap-2">
        <SlackIcon className="size-icon-sm shrink-0" aria-hidden="true" />
        <Txt as="span" variant="meta" tone="muted">
          Your message in #{origin.channel}
        </Txt>
        <span className="ms-auto flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="bg-warning-indicator absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            <span className="bg-warning-indicator relative inline-flex size-2 rounded-full" />
          </span>
          <Txt as="span" variant="meta" tone="muted">
            Waiting for setup
          </Txt>
        </span>
      </div>
      <Txt as="p" variant="body" className="border-border-strong border-s-2 ps-3">
        <span className="text-info-indicator">@{origin.agent}</span> {origin.message}
      </Txt>
    </OnboardingInset>
  );
}

function SetupComplete({ factoryId, slack, email }: { factoryId: string; slack?: SlackOrigin; email: string }) {
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
          {slack
            ? `${slack.agent} is already replying to your message in #${slack.channel}. Head back to keep the conversation going.`
            : 'Start a session, or pick up a card from the board.'}
        </Txt>
      </div>
      <div className={cn('onboarding-card bg-card flex flex-col gap-1 rounded-2xl p-1')}>
        <SummaryRow label="Account" value={email} />
        <SummaryRow label="Model" value="Claude Opus 5.5 · your Claude subscription" />
        <SummaryRow label="Slack" value="Kepler · @ward" />
      </div>
      {slack && (
        <Notice variant="success">
          Started a session from your message. Replies keep flowing to the Slack thread.
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {slack ? (
          <>
            <a href="https://slack.com/app_redirect" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              <SlackIcon className="size-icon-sm" aria-hidden="true" />
              Back to Slack
            </a>
            <Link to={`/factories/${factoryId}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              Open the session here
            </Link>
          </>
        ) : (
          <>
            <Link to={`/factories/${factoryId}/new`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Start a session
            </Link>
            <Link to={`/factories/${factoryId}/work`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
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
