import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CalendarCheck, ClipboardList, GitPullRequestArrow, Inbox, LifeBuoy, Rocket } from 'lucide-react';

import { useChatCommands } from '../context/ChatCommandsProvider';

const STARTER_PROMPTS = [
  {
    icon: GitPullRequestArrow,
    title: 'Review what’s ready',
    prompt: 'Fetch five PRs ready for review and start review sessions for all of them.',
  },
  {
    icon: Inbox,
    title: 'Triage new intake',
    prompt: 'Triage everything that arrived since yesterday. Accept the obvious ones and flag the rest for me.',
  },
  {
    icon: ClipboardList,
    title: 'Plan the top bug',
    prompt: 'Pick the highest-impact open bug and draft a plan.',
  },
  {
    icon: CalendarCheck,
    title: 'What shipped this week',
    prompt: 'Summarize what shipped this week, what’s stuck, and who’s waiting on whom.',
  },
  {
    icon: LifeBuoy,
    title: 'Unblock what’s stuck',
    prompt: 'Find failed runs and plans waiting on my approval. Retry what’s fixable and list the rest for me.',
  },
  {
    icon: Rocket,
    title: 'Close the loop on my PRs',
    prompt: 'Check my open PRs. Address review comments and re-request review where it’s ready.',
  },
];

export function StarterPrompts() {
  const { setComposerPreview, submitComposer } = useChatCommands();

  return (
    <section className="flex flex-col gap-3" aria-labelledby="starter-prompts-heading">
      <Txt as="h2" variant="eyebrow" tone="muted" id="starter-prompts-heading" className="m-0">
        Start from a prompt
      </Txt>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {STARTER_PROMPTS.map(({ icon: Icon, title, prompt }) => (
          <li key={title} className="flex">
            <button
              type="button"
              onPointerEnter={() => setComposerPreview(prompt)}
              onPointerLeave={() => setComposerPreview(null)}
              onFocus={() => setComposerPreview(prompt)}
              onBlur={() => setComposerPreview(null)}
              onClick={() => submitComposer(prompt)}
              className={cn(
                'group rounded-card border-border flex w-full cursor-pointer flex-col gap-2 border p-3 text-left',
                'hover:border-border-strong hover:bg-fill-subtle transition-colors duration-150 motion-reduce:transition-none',
                focusRing,
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  aria-hidden
                  className="text-muted-foreground group-hover:text-foreground group-focus-visible:text-foreground size-4 shrink-0 transition-colors"
                />
                <Txt as="span" variant="label" tone="ink">
                  {title}
                </Txt>
              </span>
              <Txt as="span" variant="body-sm" tone="muted" className="line-clamp-2">
                {prompt}
              </Txt>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
