import { useId, useState } from 'react';
import type { ComponentProps } from 'react';
import { AskUserContext } from './ask-user-context';
import { AskUserContainer } from './ask-user-layout';
import type { AskUserAnswer, AskUserSelectionMode } from './ask-user-types';

export interface AskUserRootProps extends Omit<ComponentProps<typeof AskUserContainer>, 'onSubmit'> {
  selectionMode?: AskUserSelectionMode;
  disabled?: boolean;
  onSubmit: (answer: AskUserAnswer) => void;
}

interface AskUserAnswerDraft {
  answerText: string;
  selectedOptionLabels: string[];
  selectionMode: AskUserSelectionMode;
  isCustomAnswerSelected: boolean;
}

function getAnswerToSubmit({
  answerText,
  selectedOptionLabels,
  selectionMode,
  isCustomAnswerSelected,
}: AskUserAnswerDraft): AskUserAnswer | undefined {
  const trimmedAnswerText = answerText.trim();
  if (isCustomAnswerSelected && !trimmedAnswerText) return undefined;
  if (selectionMode === 'single_select') {
    // Suggested single-select answers already submit when selected.
    if (!isCustomAnswerSelected && selectedOptionLabels.length > 0) return undefined;
    return trimmedAnswerText || undefined;
  }

  const answerLabels = isCustomAnswerSelected ? [...selectedOptionLabels, trimmedAnswerText] : selectedOptionLabels;
  return answerLabels.length > 0 ? answerLabels : undefined;
}

function toggleSelectedOptionLabel(selectedOptionLabels: string[], optionLabel: string): string[] {
  if (selectedOptionLabels.includes(optionLabel)) {
    return selectedOptionLabels.filter(selectedLabel => selectedLabel !== optionLabel);
  }
  return [...selectedOptionLabels, optionLabel];
}

export function AskUserRoot({
  selectionMode = 'single_select',
  disabled = false,
  onSubmit,
  children,
  ...props
}: AskUserRootProps) {
  const questionId = useId();
  const [answerText, setAnswerText] = useState('');
  const [selectedOptionLabels, setSelectedOptionLabels] = useState<string[]>([]);
  const [isCustomAnswerSelected, setIsCustomAnswerSelected] = useState(false);
  const answerToSubmit = getAnswerToSubmit({
    answerText,
    selectedOptionLabels,
    selectionMode,
    isCustomAnswerSelected,
  });
  const canSubmitAnswer = !disabled && answerToSubmit !== undefined;

  const selectOption = (optionLabel: string) => {
    if (disabled) return;
    if (selectionMode === 'multi_select') {
      setSelectedOptionLabels(currentLabels => toggleSelectedOptionLabel(currentLabels, optionLabel));
      return;
    }
    setIsCustomAnswerSelected(false);
    setSelectedOptionLabels([optionLabel]);
    onSubmit(optionLabel);
  };

  const setCustomAnswerSelected = (selected: boolean) => {
    if (disabled) return;
    setIsCustomAnswerSelected(selected);
    if (selected && selectionMode === 'single_select') setSelectedOptionLabels([]);
  };

  const changeAnswerText = (text: string) => {
    if (!disabled) setAnswerText(text);
  };

  const unselectEmptyCustomAnswer = () => {
    if (!disabled && !answerText.trim()) setIsCustomAnswerSelected(false);
  };

  const submitAnswer = () => {
    if (disabled || answerToSubmit === undefined) return;
    onSubmit(answerToSubmit);
  };

  return (
    <AskUserContext.Provider
      value={{
        questionId,
        selectionMode,
        disabled,
        answerText,
        selectedOptionLabels,
        isCustomAnswerSelected,
        canSubmitAnswer,
        selectOption,
        setCustomAnswerSelected,
        changeAnswerText,
        unselectEmptyCustomAnswer,
        submitAnswer,
      }}
    >
      <AskUserContainer role="group" aria-labelledby={questionId} {...props}>
        {children}
      </AskUserContainer>
    </AskUserContext.Provider>
  );
}
