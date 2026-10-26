import { Card } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CalendarCheck, ClipboardList, GitPullRequestArrow, Inbox, LifeBuoy, Rocket } from 'lucide-react';
import { useEffect } from 'react';

import { stageIconClass } from '../../factory/components/BoardIcons';
import { useChatCommands } from '../context/ChatCommandsProvider';

const STARTER_PROMPTS = [
  {
    icon: GitPullRequestArrow,
    stage: 'review',
    title: 'Review what’s ready',
    prompt: 'Fetch five PRs ready for review and start review sessions for all of them.',
  },
  {
    icon: Inbox,
    stage: 'triage',
    title: 'Triage new intake',
    prompt: 'Triage everything that arrived since yesterday. Accept the obvious ones and flag the rest for me.',
  },
  {
    icon: ClipboardList,
    stage: 'planning',
    title: 'Plan the top bug',
    prompt: 'Pick the highest-impact open bug and draft a plan.',
  },
  {
    icon: CalendarCheck,
    stage: 'done',
    title: 'What shipped this week',
    prompt: 'Summarize what shipped this week, what’s stuck, and who’s waiting on whom.',
  },
  {
    icon: LifeBuoy,
    stage: 'execute',
    title: 'Unblock what’s stuck',
    prompt: 'Find failed runs and plans waiting on my approval. Retry what’s fixable and list the rest for me.',
  },
  {
    icon: Rocket,
    stage: 'review',
    title: 'Close the loop on my PRs',
    prompt: 'Check my open PRs. Address review comments and re-request review where it’s ready.',
  },
];

// Outer corners of the six-card grid at one, two and three columns; inner corners stay tight.
const CARD_CORNERS = [
  'rounded-t-xl sm:rounded-tr-md',
  'sm:rounded-tr-xl lg:rounded-tr-md',
  'lg:rounded-tr-xl',
  'lg:rounded-bl-xl',
  'sm:rounded-bl-xl lg:rounded-bl-md',
  'rounded-b-xl sm:rounded-bl-md',
];

export function StarterPrompts() {
  const { setComposerPreview, submitComposer } = useChatCommands();
  // Unmounting under the pointer or focus fires no pointerleave/blur.
  useEffect(() => () => setComposerPreview(null), [setComposerPreview]);

  return (
    <ul
      aria-label="Start from a prompt"
      className="m-0 grid list-none grid-cols-1 gap-1 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {STARTER_PROMPTS.map(({ icon: Icon, stage, title, prompt }, index) => (
        <li key={title} className="flex">
          <Card
            interactive
            onPointerEnter={() => setComposerPreview(prompt)}
            onPointerLeave={() => setComposerPreview(null)}
            onFocus={() => setComposerPreview(prompt)}
            onBlur={() => setComposerPreview(null)}
            onClick={() => submitComposer(prompt)}
            className={cn(
              'w-full rounded-md text-left [--elevation-raised:var(--elevation-soft)] [--surface-rim:var(--surface-rim-soft)]',
              CARD_CORNERS[index],
            )}
          >
            <span className="flex h-full flex-col gap-2 p-3">
              <span className="flex items-center gap-2">
                <Icon aria-hidden className={cn('size-4 shrink-0', stageIconClass(stage))} />
                <Txt as="span" variant="card-title" tone="ink">
                  {title}
                </Txt>
              </span>
              <Txt as="span" variant="body-sm" tone="muted" className="line-clamp-2">
                {prompt}
              </Txt>
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
