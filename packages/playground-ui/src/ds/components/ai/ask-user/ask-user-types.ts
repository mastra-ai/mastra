export type AskUserSelectionMode = 'single_select' | 'multi_select';
export type AskUserAnswer = string | string[];

export interface AskUserOption {
  label: string;
  description?: string;
  /** The option the agent would pick. Shown as a hint; never selected for the user. */
  recommended?: boolean;
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
