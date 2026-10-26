import { Card } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CalendarCheck, ClipboardList, GitPullRequestArrow, Inbox, LifeBuoy, Rocket } from 'lucide-react';
import { useEffect } from 'react';

import { stageIconClass, stageTintClass } from '../../factory/components/BoardIcons';
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

export function StarterPrompts() {
  const { setComposerPreview, submitComposer } = useChatCommands();
  // Unmounting under the pointer or focus fires no pointerleave/blur.
  useEffect(() => () => setComposerPreview(null), [setComposerPreview]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="starter-prompts-heading">
      <Txt as="h2" variant="subheading" tone="muted" id="starter-prompts-heading" className="m-0">
        Start from a prompt
      </Txt>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {STARTER_PROMPTS.map(({ icon: Icon, stage, title, prompt }) => (
          <li key={title} className="flex">
            <Card
              interactive
              onPointerEnter={() => setComposerPreview(prompt)}
              onPointerLeave={() => setComposerPreview(null)}
              onFocus={() => setComposerPreview(prompt)}
              onBlur={() => setComposerPreview(null)}
              onClick={() => submitComposer(prompt)}
              className="w-full text-left"
            >
              <span className="flex h-full flex-col gap-2.5 p-3">
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn('grid size-7 shrink-0 place-items-center rounded-md', stageTintClass(stage))}
                  >
                    <Icon className={cn('size-4', stageIconClass(stage))} />
                  </span>
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
    </section>
  );
}
