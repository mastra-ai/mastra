export interface AskUserOption {
  label: string;
  description?: string;
}

export type AskUserSelectionMode = 'single_select' | 'multi_select';

export interface AskUserSuspendPayload {
  question: string;
  options?: AskUserOption[];
  selectionMode?: AskUserSelectionMode;
}
