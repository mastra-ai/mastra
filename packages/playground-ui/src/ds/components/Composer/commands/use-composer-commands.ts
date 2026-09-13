import type { ChangeEvent, ComponentPropsWithoutRef, KeyboardEvent, RefObject } from 'react';
import { useId, useState } from 'react';
import type { ComposerCommand, ComposerCommandOption } from './command-matches';
import { matchCommandOptions, matchCommands } from './command-matches';
import type { ComposerSuggestionItem, ComposerSuggestionsProps } from './composer-suggestions';

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

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isModified = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
    const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;
    if (isModified || isComposing || items.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setNavigation({ value, index: (activeIndex + direction + items.length) % items.length });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      returnToCommands();
      return;
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      const command = matchingCommands[activeIndex];
      const exactCommand = matchingCommands.length === 1 && value.toLowerCase() === `/${command?.name}`;
      const submitExactCommand = event.key === 'Enter' && exactCommand && !command?.options?.length;
      if (submitExactCommand) return;
      event.preventDefault();
      selectSuggestion(activeIndex);
    }
  }

  const inputProps = {
    value,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => updateValue(event.target.value),
    'aria-autocomplete': 'list',
    'aria-controls': items.length > 0 ? listId : undefined,
    'aria-activedescendant': items[activeIndex]?.id,
    onKeyDown,
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
