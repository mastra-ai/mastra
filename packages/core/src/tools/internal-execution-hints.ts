type InternalExecutionHint = boolean | ((input: unknown) => boolean);

type InternalToolExecutionHints = {
  bypassGlobalToolApproval?: InternalExecutionHint;
  safeForConcurrentExecution?: InternalExecutionHint;
};

const INTERNAL_TOOL_EXECUTION_HINTS = Symbol('mastra.core.internalToolExecutionHints');

export function setInternalToolExecutionHints<T extends object>(tool: T, hints: InternalToolExecutionHints): T {
  Object.defineProperty(tool, INTERNAL_TOOL_EXECUTION_HINTS, {
    value: hints,
    enumerable: false,
    configurable: true,
  });

  return tool;
}

export function getInternalToolExecutionHints(tool: unknown): InternalToolExecutionHints | undefined {
  if (!tool || typeof tool !== 'object') {
    return undefined;
  }

  return (tool as Record<symbol, InternalToolExecutionHints>)[INTERNAL_TOOL_EXECUTION_HINTS];
}

export function resolveInternalExecutionHint(hint: InternalExecutionHint | undefined, input: unknown): boolean {
  if (typeof hint === 'function') {
    return hint(input);
  }

  return hint === true;
}
