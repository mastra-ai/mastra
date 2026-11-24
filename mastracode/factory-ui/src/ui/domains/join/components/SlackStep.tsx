import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';

import { useApiConfig } from '../../../../api/config';
import { connectSlackUrl } from '../../settings/services/channelAccounts';
import { OnboardingInset } from '../../workspaces/components/onboarding/OnboardingInset';
import { StepCard } from '../../workspaces/components/onboarding/OnboardingStepCard';

/** Optional: links the member's Slack account so a mention runs as them. Sign-in comes back to this page. */
export function SlackStep({ index, factoryId, onSkip }: { index: number; factoryId: string; onSkip: () => void }) {
  const { baseUrl } = useApiConfig();
  return (
    <StepCard
      index={index}
      label="Slack"
      headerEnd={
        <Txt as="span" variant="meta" tone="muted" className="bg-fill rounded-full px-2 py-0.5">
          Optional
        </Txt>
      }
      note="You can link it later from Slack itself"
      primary={
        <Button variant="ghost" size="lg" onClick={onSkip}>
          Not now
        </Button>
      }
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
    </StepCard>
  );
}
