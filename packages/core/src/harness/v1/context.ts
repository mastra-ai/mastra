import type { Workspace } from '../../workspace';
import type { AgentResult, UseSkillOptions } from './types';

export type SetStateFn<TState> = {
  (updates: Partial<TState>): Promise<void>;
  (updater: (prev: TState) => TState): Promise<void>;
};

export interface RegisterQuestionParams {
  questionId: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
  selectionMode?: 'single_select' | 'multi_select';
}

export interface RegisterPlanApprovalParams {
  planId: string;
  title: string;
  plan: string;
}

export interface HarnessRequestContext<TState = unknown> {
  harnessId: string;
  sessionId: string;
  requestId: string;
  threadId: string;
  resourceId: string;
  modeId: string;
  state: TState;
  getState: () => TState;
  setState: SetStateFn<TState>;
  abortSignal: AbortSignal;
  registerQuestion: (params: RegisterQuestionParams) => void;
  registerPlanApproval: (params: RegisterPlanApprovalParams) => void;
  subagentDepth: number;
  source: 'parent' | 'subagent';
  parentSessionId?: string;
  subagentToolCallId?: string;
  getSubagentModel: (params?: { agentType?: string }) => string | null;
  workspace?: Workspace;
  useSkill: (ref: string, opts?: UseSkillOptions) => Promise<AgentResult>;
}
