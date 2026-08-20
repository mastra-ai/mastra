import { Button } from '@mastra/playground-ui/components/Button';
import { Command, CommandList } from '@mastra/playground-ui/components/Command';
import { CommandPaletteInput } from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { CREATE_FACTORY_STEPS, type CreateFactoryFlowStep } from '../../hooks/useCreateFactoryFlow';

export interface CreateFactoryPaletteProps {
  step: CreateFactoryFlowStep;
  title: string;
  placeholder: string;
  searchLabel: string;
  /** The name step types into the field instead of searching it. */
  searchable?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  /** Absent once the commit started: what the earlier steps picked is already on the server. */
  onBack?: () => void;
  /** Steps that can be left out show it as chrome, so it never scrolls away with the rows. */
  onSkip?: () => void;
  children: ReactNode;
}

const stepTransition = 'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none';

/**
 * The whole flow renders through one mounted palette: only the title and the
 * rows swap between steps, so the field keeps its focus and never blinks.
 */
export function CreateFactoryPalette({
  step,
  title,
  placeholder,
  searchLabel,
  searchable = true,
  value,
  onValueChange,
  onBack,
  onSkip,
  children,
}: CreateFactoryPaletteProps) {
  const stepIndex = CREATE_FACTORY_STEPS.indexOf(step);

  return (
    <Command
      loop
      shouldFilter={false}
      label="Create Factory"
      className="mx-auto flex h-[min(34rem,100%)] w-full max-w-2xl flex-col gap-2 overflow-visible bg-transparent"
    >
      <div className="flex min-h-8 shrink-0 items-center">
        {onBack && (
          <Button variant="ghost" size="sm" onMouseDown={event => event.preventDefault()} onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        )}
        {onSkip && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onMouseDown={event => event.preventDefault()}
            onClick={onSkip}
          >
            Skip
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 px-1">
        <Txt key={step} as="h1" variant="ui-md" className={cn('text-icon6 min-w-0 flex-1 truncate', stepTransition)}>
          {title}
        </Txt>
        <ol className="flex shrink-0 gap-1" aria-label={`Step ${stepIndex + 1} of ${CREATE_FACTORY_STEPS.length}`}>
          {CREATE_FACTORY_STEPS.map((item, index) => (
            <li
              key={item}
              aria-current={item === step ? 'step' : undefined}
              className={cn(
                'h-1 w-6 rounded-full transition-colors',
                index <= stepIndex ? 'bg-accent1' : 'bg-surface4',
              )}
            />
          ))}
        </ol>
      </div>

      <CommandPaletteInput
        autoFocus
        aria-label={searchLabel}
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
        rightSlot={<Kbd size="sm">Esc</Kbd>}
        wrapperClassName={cn(
          'border-border1 bg-surface3 h-14 shrink-0 rounded-xl border px-4',
          !searchable && '[&>svg]:hidden',
        )}
      />

      <div className="flex shrink-0 items-center justify-end gap-1.5 px-1">
        <Kbd size="sm">↑</Kbd>
        <Kbd size="sm">↓</Kbd>
        <Kbd size="sm">↵</Kbd>
        <Kbd size="sm">Esc</Kbd>
      </div>

      <CommandList
        scrollArea
        aria-label={title}
        className="max-h-none rounded-none border-none bg-transparent px-0 py-1 shadow-none"
        scrollAreaClassName="min-h-0 flex-1"
      >
        {/* Selecting a row must not pull focus out of the field: typing keeps working after a click. */}
        <div key={step} className={stepTransition} onMouseDown={event => event.preventDefault()}>
          {children}
        </div>
      </CommandList>
    </Command>
  );
}

export function CreateFactoryPaletteAlert({ children }: { children: ReactNode }) {
  return (
    <Txt as="p" role="alert" variant="ui-sm" className="text-notice-destructive-fg m-0 px-3 py-2">
      {children}
    </Txt>
  );
}

export function CreateFactoryPaletteMessage({ children }: { children: ReactNode }) {
  return (
    <Txt as="p" variant="ui-sm" className="text-icon3 m-0 px-3 py-2">
      {children}
    </Txt>
  );
}
