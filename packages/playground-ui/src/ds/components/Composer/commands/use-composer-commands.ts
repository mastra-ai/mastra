import type { ChangeEvent, ComponentPropsWithoutRef, RefObject } from 'react';
import { useId, useState } from 'react';
import type { ComposerCommand, ComposerCommandOption } from './command-matches';
import { matchCommandOptions, matchCommands } from './command-matches';
import type { ComposerSuggestionItem, ComposerSuggestionsProps } from './composer-suggestions';
import { useKeydown } from '@/lib/keyboard/use-keydown';

function createSuggestionItems(
  listId: string,
  commands: readonly ComposerCommand[],
  options?: readonly ComposerCommandOption[],
): ComposerSuggestionItem[] {
  if (options)
    return options.map(option => ({ ...option, id: `${listId}-option-${encodeURIComponent(option.value)}` }));
  return commands.map(command => ({
    id: `${listId}-command-${encodeURIComponent(command.name)}`,
    label: `/${command.name}`,
    description: command.description,
  }));
}

export interface UseComposerCommandsProps {
  commands: readonly ComposerCommand[];
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  enabled?: boolean;
}

export function useComposerCommands({
  commands,
  value,
  onValueChange,
  onSubmit,
  inputRef,
  enabled = true,
}: UseComposerCommandsProps) {
  const listId = useId();
  const [navigation, setNavigation] = useState({ value: '', index: 0 });
  const optionMatch = enabled ? matchCommandOptions(commands, value) : undefined;
  const matchingCommands = enabled && !optionMatch ? matchCommands(commands, value) : [];
  const items = createSuggestionItems(listId, matchingCommands, optionMatch?.options);
  const boundedIndex = Math.min(navigation.index, Math.max(0, items.length - 1));
  const activeIndex = navigation.value === value ? boundedIndex : 0;

  function updateValue(nextValue: string) {
    setNavigation({ value: nextValue, index: 0 });
    onValueChange(nextValue);
  }

  function returnToCommands() {
    updateValue(optionMatch ? `/${optionMatch.command.name}` : '');
    inputRef.current?.focus();
  }

  function selectSuggestion(index: number) {
    inputRef.current?.focus();
    if (optionMatch) {
      const option = optionMatch.options[index];
      if (option) onSubmit(`/${optionMatch.command.name} ${option.value}`);
      return;
    }
    const command = matchingCommands[index];
    if (command) updateValue(`/${command.name} `);
  }

  function moveSelection(direction: number) {
    setNavigation({ value, index: (activeIndex + direction + items.length) % items.length });
  }

  function shouldHandleCommandKey(event: KeyboardEvent) {
    const command = matchingCommands[activeIndex];
    const submitExactCommand =
      matchingCommands.length === 1 && value.toLowerCase() === `/${command?.name}` && !command?.options?.length;
    return event.key !== 'Enter' || !submitExactCommand;
  }

  useKeydown(
    {
      ArrowDown: () => moveSelection(1),
      ArrowUp: () => moveSelection(-1),
      Escape: returnToCommands,
      Tab: () => selectSuggestion(activeIndex),
      Enter: () => selectSuggestion(activeIndex),
    },
    {
      target: inputRef,
      enabled: items.length > 0,
      shouldHandle: shouldHandleCommandKey,
    },
  );

  const inputProps = {
    value,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => updateValue(event.target.value),
    'aria-autocomplete': 'list',
    'aria-controls': items.length > 0 ? listId : undefined,
    'aria-activedescendant': items[activeIndex]?.id,
  } satisfies ComponentPropsWithoutRef<'textarea'>;

  const suggestionsProps: ComposerSuggestionsProps = {
    id: listId,
    items,
    activeIndex,
    contextLabel: optionMatch ? `/${optionMatch.command.name}` : undefined,
    onBack: optionMatch ? returnToCommands : undefined,
    onSelect: selectSuggestion,
  };

  return { inputProps, suggestionsProps };
}
