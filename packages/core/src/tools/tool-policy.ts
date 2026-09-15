import type { RequestContext } from '../request-context';

export interface ToolPolicyArgs {
  toolName: string;
  requestContext?: RequestContext;
  phase: 'load' | 'active' | 'execute';
  input?: unknown;
  /** False for tools executed outside this server's runtime. */
  hasExecute?: boolean;
}

export type ToolPolicyDecision = { allowed: true } | { allowed: false; error: Record<string, unknown> };

/** Mandatory server policy, evaluated independently of overridable agent hooks. */
export type ToolPolicy = (args: ToolPolicyArgs) => ToolPolicyDecision | Promise<ToolPolicyDecision>;

export interface ToolPolicyResolverArgs {
  requestContext?: RequestContext;
  agentId?: string;
  runId?: string;
}
export type ToolPolicyConfig =
  | ToolPolicy
  | {
      /** Resolved once per native preparation; the resulting policy is held by that run. */
      resolve: (args: ToolPolicyResolverArgs) => ToolPolicy | Promise<ToolPolicy>;
    };

/** A structured policy/configuration failure. A parked tool remains resumable. */
export class ToolPolicyError extends Error {
  readonly code: string;
  readonly tool?: string;
  readonly missingSkills?: string[];
  readonly unavailableSkills?: string[];
  readonly retryable: boolean;

  constructor(
    details: {
      code: string;
      tool?: string;
      missingSkills?: string[];
      unavailableSkills?: string[];
      retryable: boolean;
    },
    options?: { cause?: unknown; message?: string },
  ) {
    super(options?.message ?? 'Tool policy could not permit this operation.', { cause: options?.cause });
    this.name = 'ToolDependencyError';
    this.code = details.code;
    this.tool = details.tool;
    this.missingSkills = details.missingSkills;
    this.unavailableSkills = details.unavailableSkills;
    this.retryable = details.retryable;
  }
}
