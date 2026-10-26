import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Bug, CalendarCheck, GitPullRequestArrow, Inbox, LifeBuoy, MessageSquareText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';

import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useItemDecisions } from '../../factory/hooks/useBoardDecisions';
import { starterPrompts } from '../../factory/starterPrompts';
import type { StarterKind } from '../../factory/starterPrompts';
import { useChatCommands } from '../context/ChatCommandsProvider';

const KIND_ICONS: Record<StarterKind, { icon: LucideIcon; className: string }> = {
  unblock: { icon: LifeBuoy, className: 'text-(--blue-500) dark:text-(--blue-400)' },
  feedback: { icon: MessageSquareText, className: 'text-(--pink-500) dark:text-(--pink-400)' },
  review: { icon: GitPullRequestArrow, className: 'text-(--green-500) dark:text-(--green-400)' },
  triage: { icon: Inbox, className: 'text-(--orange-500) dark:text-(--orange-400)' },
  bug: { icon: Bug, className: 'text-(--amber-600) dark:text-(--amber-400)' },
  shipped: { icon: CalendarCheck, className: 'text-(--purple-500) dark:text-(--purple-400)' },
};

export function StarterPrompts({ factoryId }: { factoryId: string }) {
  const { setComposerPreview, submitComposer } = useChatCommands();
  const cards = useWorkItemsQuery(factoryId).data ?? [];
  const { effectByItem } = useItemDecisions(factoryId);
  // Unmounting under the pointer or focus fires no pointerleave/blur.
  useEffect(() => () => setComposerPreview(null), [setComposerPreview]);

  const prompts = starterPrompts({ cards, effectByItem, now: new Date() });
  if (prompts.length === 0) return null;

  return (
    <ul aria-label="Start from a prompt" className="divide-border m-0 flex list-none flex-col divide-y p-0">
      {prompts.map(({ kind, title, detail, prompt }) => {
        const { icon: Icon, className } = KIND_ICONS[kind];
        return (
          <li key={kind}>
            <button
              type="button"
              onPointerEnter={() => setComposerPreview(prompt)}
              onPointerLeave={() => setComposerPreview(null)}
              onFocus={() => setComposerPreview(prompt)}
              onBlur={() => setComposerPreview(null)}
              onClick={() => submitComposer(prompt)}
              className={cn(
                'group flex w-full cursor-pointer items-center gap-3 rounded-md py-2.5 text-left',
                focusRing,
              )}
            >
              <Icon aria-hidden className={cn('size-4 shrink-0', className)} />
              <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
                {title}
              </Txt>
              <Txt as="span" variant="body-sm" tone="muted" className="min-w-0 flex-1 truncate max-sm:hidden">
                {detail}
              </Txt>
              <ArrowRight
                aria-hidden
                className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
