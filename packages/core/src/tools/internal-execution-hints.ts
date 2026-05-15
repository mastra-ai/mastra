type InternalExecutionHint = boolean | ((input: unknown) => boolean);

type InternalToolExecutionHints = {
  bypassGlobalToolApproval?: InternalExecutionHint;
  safeForConcurrentExecution?: InternalExecutionHint;
};

const INTERNAL_TOOL_EXECUTION_HINTS = Symbol('mastra.core.internalToolExecutionHints');

/**
 * Stores trusted, engine-internal execution hints on a tool without exposing
 * them through the public tool shape or provider-facing schema serialization.
 */
export function setInternalToolExecutionHints<T extends object>(tool: T, hints: InternalToolExecutionHints): T {
  Object.defineProperty(tool, INTERNAL_TOOL_EXECUTION_HINTS, {
    value: hints,
    enumerable: false,
    configurable: true,
  });

  return tool;
}

/**
 * Reads trusted execution hints previously attached with `setInternalToolExecutionHints`.
 */
export function getInternalToolExecutionHints(tool: unknown): InternalToolExecutionHints | undefined {
  if (!tool || (typeof tool !== 'object' && typeof tool !== 'function')) {
    return undefined;
  }

  return (tool as Record<symbol, InternalToolExecutionHints>)[INTERNAL_TOOL_EXECUTION_HINTS];
}

/**
 * Resolves either a static execution hint or an input-sensitive execution hint.
 */
export function resolveInternalExecutionHint(hint: InternalExecutionHint | undefined, input: unknown): boolean {
  if (typeof hint === 'function') {
    return hint(input);
  }

  return hint === true;
}
