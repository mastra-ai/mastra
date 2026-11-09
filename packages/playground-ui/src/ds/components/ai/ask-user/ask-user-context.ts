import { createContext, useContext } from 'react';
import type { AskUserSelectionMode } from './ask-user-types';

interface AskUserContextValue {
  questionId: string;
  selectionMode: AskUserSelectionMode;
  disabled: boolean;
  answerText: string;
  selectedOptionLabels: string[];
  isCustomAnswerSelected: boolean;
  canSubmitAnswer: boolean;
  selectOption: (optionLabel: string) => void;
  setCustomAnswerSelected: (selected: boolean) => void;
  changeAnswerText: (text: string) => void;
  unselectEmptyCustomAnswer: () => void;
  submitAnswer: () => void;
}

export const AskUserContext = createContext<AskUserContextValue | undefined>(undefined);

export function useOptionalAskUserContext() {
  return useContext(AskUserContext);
}

export function useAskUserContext() {
  const context = useOptionalAskUserContext();
  if (!context) throw new Error('AskUser controls must be rendered inside AskUser.Root.');
  return context;
}
