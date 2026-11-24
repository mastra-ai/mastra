export type AskUserSelectionMode = 'single_select' | 'multi_select';
export type AskUserAnswer = string | string[];

export interface AskUserOption {
  label: string;
  description?: string;
}

export interface AskUserPayload {
  question: string;
  options?: AskUserOption[];
  selectionMode?: AskUserSelectionMode;
}

export interface AskUserResult {
  content: string;
  isError?: boolean;
}
