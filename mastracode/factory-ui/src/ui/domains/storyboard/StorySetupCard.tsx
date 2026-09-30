import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { PLANS } from './cast';
import { useStoryboard } from './StoryboardProvider';

export function StorySetupCard() {
  const storyboard = useStoryboard();
  const [dismissedStep, setDismissedStep] = useState<string>();
  if (storyboard === null || storyboard.state.sharedAccount !== null) return null;
  const { patch } = storyboard;
  const stepKey = `${storyboard.story.id}:${storyboard.stepIndex}`;
  if (dismissedStep === stepKey) return null;

  return (
    <article
      aria-labelledby="story-setup-card-title"
      data-testid="story-setup-card"
      className="rounded-card border-warning-edge bg-fill-subtle flex min-h-36 flex-col gap-3 border p-2"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Txt as="span" variant="meta" tone="faint" className="flex items-center gap-1.5">
          <TriangleAlert size={11} className="text-warning-indicator" aria-hidden />
          Setup · no Factory account
        </Txt>
        <Txt as="h3" id="story-setup-card-title" variant="label" tone="ink" className="font-[550] tracking-tight">
          Connect a Factory account for Factory work
        </Txt>
        <Txt variant="meta" tone="muted">
          Until then, cards run on their owner's plan and auto-start stays paused: with nobody around, nobody would pay.
        </Txt>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="primary"
          icon={<KeyRound aria-hidden />}
          onClick={() => patch({ sharedAccount: PLANS.companyAnthropicKey })}
        >
          Connect a Factory account
        </Button>
        <Button
          size="sm"
          onClick={() => {
            patch({ factoryWorkRunsOn: 'owner' });
            setDismissedStep(stepKey);
          }}
        >
          Set up later
        </Button>
      </div>
    </article>
  );
}
