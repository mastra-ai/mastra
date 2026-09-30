import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';

import type { OnboardingFlow } from './storyState';

function ConnectionRow({
  icon,
  name,
  detail,
  connected,
}: {
  icon: ReactNode;
  name: string;
  detail: string;
  connected: boolean;
}) {
  return (
    <li className={cn(raisedSurfaceStyle, 'flex items-center gap-3 rounded-xl p-4')}>
      <span className="flex size-8 shrink-0 items-center justify-center [&>svg]:size-5">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Txt as="span" variant="label" tone="ink">
          {name}
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          {detail}
        </Txt>
      </span>
      {connected ? (
        <Badge size="sm" variant="success" emphasis="subtle" icon={<Check aria-hidden />}>
          Connected
        </Badge>
      ) : (
        <Badge size="sm" emphasis="subtle">
          Later
        </Badge>
      )}
    </li>
  );
}

const GITHUB_DETAILS: Record<OnboardingFlow, string> = {
  cloudflare: 'cloudflare · 214 repositories',
  'small-team': 'acme-team · 3 repositories',
  solo: 'damien-schneider · 4 repositories',
};

export function StoryOnboardingConnect({ flow, onContinue }: { flow: OnboardingFlow; onContinue: () => void }) {
  const withLinear = flow === 'cloudflare';
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        <ConnectionRow icon={<GithubIcon />} name="GitHub" detail={GITHUB_DETAILS[flow]} connected />
        <ConnectionRow
          icon={<LinearIcon />}
          name="Linear"
          detail={
            withLinear ? 'Cloudflare workspace · every open issue becomes a card' : 'Optional: add it from settings'
          }
          connected={withLinear}
        />
      </ul>
      <div>
        <Button variant="primary" onClick={onContinue}>
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
