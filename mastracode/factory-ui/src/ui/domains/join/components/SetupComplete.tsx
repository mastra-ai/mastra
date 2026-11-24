import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { Link } from 'react-router';

import type { ConnectedChannelAccount } from '../../settings/services/channelAccounts';
import { StepDoneRow } from '../../workspaces/components/onboarding/OnboardingStepRow';
import { slackAccountLabel, slackClientUrl } from '../services/memberSetup';
import type { SlackOrigin } from '../services/memberSetup';

/** What the member set up, and where to go next: back to the Slack thread they came from, or into the Factory. */
export function SetupComplete({
  factoryId,
  origin,
  account,
  modelId,
  slackAccount,
}: {
  factoryId: string;
  origin: SlackOrigin | undefined;
  account: string;
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
      <div className="flex flex-col gap-2">
        <StepDoneRow label="Account" value={account} />
        {modelId && <StepDoneRow label="Model" value={modelId} />}
        {slackAccount && <StepDoneRow label="Slack" value={slackAccountLabel(slackAccount)} />}
      </div>
      {origin ? (
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/factories/${factoryId}/new`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            Start a session
          </Link>
          <Link to={`/factories/${factoryId}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            Go to the board
          </Link>
        </div>
      )}
    </div>
  );
}
