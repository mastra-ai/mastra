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

/**
 * Output returned by the built-in `ask_user` tool. Every return branch in
 * `packages/core/src/tools/builtin/ask-user.ts` produces this shape, so the
 * playground can render `content` directly without inspecting the runtime type.
 */
export interface AskUserResult {
  content: string;
  isError: boolean;
}

export interface SubmitPlanSuspendPayload {
  path?: string;
  title?: string;
  plan?: string;
}

export interface SubmitPlanResult {
  content: string;
  isError: boolean;
  action?: 'approved' | 'rejected';
  feedback?: string;
  submittedPlan?: {
    path?: string;
    title?: string;
    plan?: string;
  };
}

export interface SubmitPlanResumeData {
  action: 'approved' | 'rejected';
  feedback?: string;
  path?: string;
  title?: string;
  plan?: string;
}
