import type { BehaviorNode } from '../definition/resolver.js';

export type BehaviorStatus = 'active' | 'paused' | 'error';

export type BehaviorTransitionRecord = {
  id: string;
  transitionId: string;
  from: string;
  to?: string;
  at: string;
  revision: number;
  reason?: string;
};

export type BehaviorRuntimeRecord = {
  threadId: string;
  behaviorId: string;
  definitionVersion: string;
  revision: number;
  status: BehaviorStatus;
  activeState: string;
  enteredAt: string;
  intent?: string;
  transitionHistory: BehaviorTransitionRecord[];
  conditionState: Record<string, unknown>;
  checkpoints: Record<string, string>;
  judgeResults: Record<string, unknown>;
  nextCheckAt?: string;
  pausedReason?: string;
  error?: string;
  audit: Record<string, unknown>;
};

export type BehaviorThreadKey = { threadId: string; behaviorId: string };
export type BehaviorDueWork = BehaviorThreadKey & { dueAt: string };
export type BehaviorTransactionResult<T> = { next: BehaviorRuntimeRecord; result: T };

export interface BehaviorRuntimeStore {
  init(): Promise<void>;
  readThread(key: BehaviorThreadKey): Promise<BehaviorRuntimeRecord | undefined>;
  transactThread<T>(
    key: BehaviorThreadKey,
    operation: (current: BehaviorRuntimeRecord | undefined) => Promise<BehaviorTransactionResult<T>> | BehaviorTransactionResult<T>,
  ): Promise<{ runtime: BehaviorRuntimeRecord; result: T }>;
  listDue(before: Date, limit?: number): Promise<BehaviorDueWork[]>;
}

export type BehaviorGuardEvaluator = (input: {
  record: BehaviorRuntimeRecord;
  destination: BehaviorNode;
  conditionState: Readonly<Record<string, unknown>>;
}) => boolean | Promise<boolean>;

export type BehaviorTransitionJudge = (input: {
  record: BehaviorRuntimeRecord;
  current: BehaviorNode;
  destination: BehaviorNode;
  judgeInstructions?: string;
  signal?: AbortSignal;
}) => Promise<{ approved: boolean; reason?: string; metadata?: unknown }>;

export type BehaviorThreadStateMirror = {
  setState<T>(args: { threadId: string; type: string; value: T }): Promise<void>;
};
