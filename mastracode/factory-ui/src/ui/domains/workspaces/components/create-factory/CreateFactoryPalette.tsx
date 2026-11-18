import { Button } from '@mastra/playground-ui/components/Button';
import { Command, CommandList } from '@mastra/playground-ui/components/Command';
import { CommandPaletteInput } from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { CREATE_FACTORY_STEPS } from '../../hooks/useCreateFactoryFlow';
import type { CreateFactoryFlowStep } from '../../hooks/useCreateFactoryFlow';
import { IconArrowLeft } from '@mastra/playground-ui/icons/central/IconArrowLeft';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';

export interface CreateFactoryPaletteProps {
  step: CreateFactoryFlowStep;
  value: string;
  onValueChange: (value: string) => void;
  /** Back navigation to the previous step. Omitted on the first step. */
  onBack?: () => void;
  /** Steps that can be left out show it as chrome, so it never scrolls away with the rows. */
  onSkip: () => void;
  children: ReactNode;
}

interface StepChrome {
  title: string;
  placeholder: string;
  searchable?: boolean;
  skippable?: boolean;
}

const STEP_CHROME: Record<CreateFactoryFlowStep, StepChrome> = {
  name: {
    title: 'Name your new Factory',
    placeholder: 'e.g. Mastra',
    searchable: false,
  },
  vcs: {
    title: 'Choose your codebase',
    placeholder: 'Search repositories',
  },
  'project-management': {
    title: 'Connect the work behind the code',
    placeholder: 'Search options',
    skippable: true,
  },
  'model-provider': {
    title: 'Choose your Factory model',
    placeholder: 'Search models and providers',
  },
};

const stepTransition = 'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none';

/**
 * The whole flow renders through one mounted palette: only the title and the
 * rows swap between steps, so the field keeps its focus and never blinks.
 */
export function CreateFactoryPalette({
  step,
  value,
  onValueChange,
  onBack,
  onSkip,
  children,
}: CreateFactoryPaletteProps) {
  const { title, placeholder, searchable = true, skippable = false } = STEP_CHROME[step];
  const stepIndex = CREATE_FACTORY_STEPS.indexOf(step);

  return (
    <Command
      loop
      shouldFilter={false}
      label={title}
      className="flex max-h-[34rem] w-full flex-col gap-2 overflow-visible bg-transparent"
    >
      <div className="flex shrink-0 items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={event => event.preventDefault()}
            onClick={onBack}
            aria-label="Go back to previous step"
          >
            <IconArrowLeft aria-hidden="true" />
            Back
          </Button>
        )}
        <Txt
          tone="ink"
          key={step}
          as="p"
          aria-hidden="true"
          variant="body"
          className={cn('min-w-0 flex-1 truncate', stepTransition)}
        >
          {title}
        </Txt>
        {skippable && (
          <Button variant="ghost" size="sm" onMouseDown={event => event.preventDefault()} onClick={onSkip}>
            Skip
            <IconArrowRight aria-hidden="true" />
          </Button>
        )}
        <ol className="flex shrink-0 gap-1" aria-label={`Step ${stepIndex + 1} of ${CREATE_FACTORY_STEPS.length}`}>
          {CREATE_FACTORY_STEPS.map((item, index) => (
            <li
              key={item}
              aria-current={item === step ? 'step' : undefined}
              className={cn(
                'h-1 w-6 rounded-full transition-colors',
                index <= stepIndex ? 'bg-success-indicator' : 'bg-fill',
              )}
            />
          ))}
        </ol>
      </div>

      <CommandPaletteInput
        autoFocus
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
        rightSlot={<Kbd size="sm">Esc</Kbd>}
        wrapperClassName={cn('h-14 px-4', !searchable && '[&>svg]:hidden')}
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
    <Txt as="p" role="alert" variant="caption" className="text-destructive-foreground m-0 px-3 py-2">
      {children}
    </Txt>
  );
}

export function CreateFactoryPaletteMessage({ children }: { children: ReactNode }) {
  return (
    <Txt tone="muted" as="p" variant="caption" className="m-0 px-3 py-2">
      {children}
    </Txt>
  );
}
