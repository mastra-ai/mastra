import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import type { CSSProperties } from 'react';

import type { StarterPrompt } from '../../../factory/starterPrompts';
import { usePromptButton } from '../../hooks/usePromptButton';
import { StarterArt } from './StarterArt';
import { starterCellClasses } from './starterGrid';
import '../chat-enter.css';

interface StaggerStyle extends CSSProperties {
  '--i': number;
}

export function StarterCard({ starter, index, count }: { starter: StarterPrompt; index: number; count: number }) {
  const promptButton = usePromptButton(starter.prompt);
  const labelId = useId();
  const valueId = useId();
  const stagger: StaggerStyle = { '--i': index };
  return (
    <li
      className={cn(
        'starter-enter group/starter bg-card dark:bg-muted shadow-raised hover:shadow-overlay duration-fast ease-out-custom relative flex min-w-0 flex-col overflow-hidden p-3.5 transition-shadow hover:z-10 hover:[--surface-rim:var(--border-hover)] motion-reduce:transition-none sm:p-4',
        'has-[:focus-visible]:outline-border-focus has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid',
        starterCellClasses(index, count),
      )}
      style={stagger}
    >
      <StarterArt kind={starter.kind} />
      <Txt as="span" id={labelId} variant="body-sm" tone="ink" className="truncate font-medium sm:pr-18">
        {starter.label}
      </Txt>
      <span id={valueId} className="mt-1 flex min-w-0 items-baseline gap-1.5 sm:pr-18">
        <Txt
          as="span"
          variant="display"
          font="display"
          tone="ink"
          className="leading-none font-light tracking-tight tabular-nums"
        >
          {starter.value.toLocaleString()}
        </Txt>
        {starter.unit && (
          <Txt as="span" variant="body-sm" tone="muted">
            {starter.unit}
          </Txt>
        )}
      </span>
      <button
        type="button"
        aria-describedby={`${labelId} ${valueId}`}
        {...promptButton}
        className={cn(
          textStyle({ variant: 'caption', tone: 'muted' }),
          "group-hover/starter:text-foreground duration-fast ease-out-custom mt-auto flex cursor-pointer items-center gap-1 pt-2.5 text-left transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
        )}
      >
        {starter.action}
        <ArrowRight
          aria-hidden
          className="duration-fast ease-out-custom size-3.5 transition-transform group-hover/starter:translate-x-0.5 motion-reduce:transition-none"
        />
      </button>
    </li>
  );
}
