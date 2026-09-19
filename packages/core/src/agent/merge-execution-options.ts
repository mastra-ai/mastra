import { deepMerge } from '../utils';

/**
 * Internal execution-option composers run after caller options have been
 * merged over agent defaults. They let framework-owned lanes add behavior
 * without replacing an application's configured callback.
 *
 * @internal
 */
export const AGENT_EXECUTION_OPTION_COMPOSERS = Symbol('agentExecutionOptionComposers');

/** Internal marker returned only by a framework-owned response-recovery continuation hook. */
export const AGENT_RESPONSE_RECOVERY_CONTINUATION = Symbol('agentResponseRecoveryContinuation');

/** Internal marker returned by the matching response-only prepareStep hook. */
export const AGENT_RESPONSE_RECOVERY_STEP = Symbol('agentResponseRecoveryStep');

export type AgentExecutionOptionComposers = Partial<
  Record<'onIterationComplete' | 'prepareStep', (existing: unknown) => unknown>
> & {
  /** Internal recovery calls that may run only after the ordinary maxSteps boundary. */
  recoveryMaxSteps?: number;
};
export type AgentExecutionOptionComposerFactory = () => AgentExecutionOptionComposers;

const AGENT_CONFIGURED_EXECUTION_HOOKS = Symbol('agentConfiguredExecutionHooks');
type AgentConfiguredExecutionHooks = Partial<Record<'onIterationComplete' | 'prepareStep', unknown>>;

/**
 * Logical message identity belongs to one admitted execution. Even when a
 * caller bypasses the AgentConfig type with JavaScript or a cast, reusable
 * defaults must not seed a later run with that identity.
 */
export function omitLogicalMessageIdentity<T extends Record<string, any>>(
  options: T,
): Omit<T, 'logicalMessageIdentity'> {
  const { logicalMessageIdentity, ...sanitized } = options;
  void logicalMessageIdentity;
  return sanitized as Omit<T, 'logicalMessageIdentity'>;
}

/**
 * Merge agent defaults beneath per-execution options while preserving the
 * replacement tool-surface ceiling. Plain deep merge is unsafe here because
 * it would retain default toolsets when a caller explicitly requested a
 * replacement surface.
 */
export function mergeAgentExecutionOptions(
  defaultOptions: Record<string, any>,
  callerOptions: Record<string, any>,
): Record<string, any> {
  const merged = deepMerge(
    omitLogicalMessageIdentity(defaultOptions) as Record<string, unknown>,
    callerOptions as Record<string, unknown>,
  ) as Record<string, any>;
  const callerSymbols = callerOptions as Record<PropertyKey, any>;
  const configuredHooks = (callerSymbols[AGENT_CONFIGURED_EXECUTION_HOOKS] as
    | AgentConfiguredExecutionHooks
    | undefined) ?? {
    onIterationComplete: merged.onIterationComplete,
    prepareStep: merged.prepareStep,
  };

  const createComposers = callerSymbols[AGENT_EXECUTION_OPTION_COMPOSERS] as
    | AgentExecutionOptionComposerFactory
    | undefined;
  // `deepMerge` intentionally copies only enumerable string keys. Preserve the
  // internal symbol metadata so an enclosing execution boundary can create a
  // fresh, run-local composer from the original configured hooks instead of
  // silently reusing or nesting already-wrapped callbacks.
  if (createComposers) {
    const mergedSymbols = merged as Record<PropertyKey, any>;
    mergedSymbols[AGENT_EXECUTION_OPTION_COMPOSERS] = createComposers;
    mergedSymbols[AGENT_CONFIGURED_EXECUTION_HOOKS] = configuredHooks;
  }

  if (merged.toolsetsMode === 'replace') {
    if (callerOptions.toolsetsMode === 'replace') {
      merged.toolsets = callerOptions.toolsets ?? {};
    } else if (callerOptions.toolsets !== undefined) {
      merged.toolsets = callerOptions.toolsets;
    }
  }

  const composers = createComposers?.();
  if (composers?.recoveryMaxSteps !== undefined) {
    merged.recoveryMaxSteps = composers.recoveryMaxSteps;
  }
  for (const key of ['onIterationComplete', 'prepareStep'] as const) {
    const compose = composers?.[key];
    if (compose) merged[key] = compose(configuredHooks[key]);
  }

  return merged;
}
