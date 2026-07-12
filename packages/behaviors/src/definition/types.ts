export type BehaviorGuard = { id: string; description?: string };

export type BehaviorTransitionInput = {
  id: string;
  target: string;
  description?: string;
  guards?: BehaviorGuard[];
  judge?: boolean;
};

export type BehaviorStateInput = {
  id: string;
  description?: string;
  instructions?: string;
  judgeInstructions?: string;
  agentsFile?: string;
  judgeFile?: string;
  skills?: string[];
  tools?: string[];
  model?: string;
  judgeModel?: string;
  transitions: BehaviorTransitionInput[];
  periodic?: { intervalMs: number; transition: string };
};

export type BehaviorDefinitionInput = {
  id: string;
  version: string;
  initialState: string;
  states: BehaviorStateInput[];
  migrations?: Record<string, string>;
};

export type NormalizedBehaviorTransition = Readonly<{
  id: string;
  target: string;
  description?: string;
  guards: readonly Readonly<BehaviorGuard>[];
  judge: boolean;
}>;

export type NormalizedBehaviorState = Readonly<{
  id: string;
  description?: string;
  instructions?: string;
  judgeInstructions?: string;
  skills: readonly string[];
  tools: readonly string[];
  model?: string;
  judgeModel?: string;
  transitions: readonly NormalizedBehaviorTransition[];
  periodic?: Readonly<{ intervalMs: number; transition: string }>;
}>;

export type NormalizedBehaviorDefinition = Readonly<{
  id: string;
  version: string;
  root?: string;
  initialState: string;
  states: Readonly<Record<string, NormalizedBehaviorState>>;
  migrations: Readonly<Record<string, string>>;
}>;

export type BehaviorDiagnostic = { path: string; message: string };

export class BehaviorDefinitionError extends Error {
  constructor(readonly diagnostics: BehaviorDiagnostic[]) {
    super(diagnostics.map(item => `${item.path}: ${item.message}`).join('\n'));
    this.name = 'BehaviorDefinitionError';
  }
}
