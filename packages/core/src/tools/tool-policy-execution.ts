import { consumeBuilderValidatedInput, markBuilderValidatedInput } from './builder-validation-context';
import type { RequestContext } from '../request-context';
import type { StandardSchemaWithJSON } from '../schema';
import { captureToolInput, restoreToolInput } from './resumable-input';
import type { ToolPolicy } from './tool-policy';
import type { MastraToolInvocationOptions } from './types';
import { validateToolInput } from './validation';

/** Native-only invocation metadata; never serialized or passed to user callbacks. */
export const TOOL_EXECUTION_POLICY = Symbol('mastra.toolExecutionPolicy');
const ACCEPTS_EXECUTION_POLICY = Symbol('mastra.acceptsExecutionPolicy');

type PolicyInvocation = {
  policy: ToolPolicy;
  toolName: string;
  requestContext?: RequestContext;
};
export type ToolPolicyInvocationOptions = {
  [TOOL_EXECUTION_POLICY]?: PolicyInvocation;
};

export function markPolicyExecutor<T extends Function>(execute: T): T {
  Object.defineProperty(execute, ACCEPTS_EXECUTION_POLICY, { value: true });
  return execute;
}

export async function checkExecutionPolicy(options: ToolPolicyInvocationOptions | undefined, input: unknown) {
  const invocation = options?.[TOOL_EXECUTION_POLICY];
  return invocation?.policy({
    toolName: invocation.toolName,
    requestContext: invocation.requestContext,
    phase: 'execute',
    hasExecute: true,
    input,
  });
}

/** All agent dispatch paths use this after selecting the final tool instance. */
export async function executeToolWithPolicy(
  tool: {
    execute?: Function;
    inputSchema?: unknown;
    parameters?: unknown;
  },
  toolName: string,
  input: unknown,
  options: MastraToolInvocationOptions | undefined,
  policy?: ToolPolicy,
  requestContext?: RequestContext,
): Promise<any> {
  if (!tool.execute) return;
  policy ??= options?.[TOOL_EXECUTION_POLICY]?.policy;
  if (!policy) return tool.execute(input, options);
  // Preserve the native run's authoritative context through builder/context copies.
  const invocation = options?.[TOOL_EXECUTION_POLICY] ?? { policy, toolName, requestContext };
  const policyOptions = withToolPolicyInvocation(options, invocation);
  if ((tool.execute as any)[ACCEPTS_EXECUTION_POLICY]) return tool.execute(input, policyOptions);

  // Already-converted tools supplied by a processor may have no native builder.
  // Validate once here; native builders and Tool instances do so inside their executor.
  let accepted = input;
  if (options?.resumeData !== undefined) {
    accepted = restoreToolInput(options, input, toolName.startsWith('agent-') || toolName.startsWith('workflow-'));
  } else {
    const validated = validateToolInput(
      (tool.inputSchema ?? tool.parameters) as StandardSchemaWithJSON | undefined,
      input,
      toolName,
    );
    if (validated.error) return validated.error;
    accepted = validated.data;
  }
  const decision = await checkExecutionPolicy(policyOptions, accepted);
  if (decision?.allowed === false) return decision.error;
  captureToolInput(options, accepted, { toolName, toolCallId: options?.toolCallId });
  const { [TOOL_EXECUTION_POLICY]: _policy, ...publicOptions } = options ?? {};
  return tool.execute(accepted, publicOptions);
}

/** Recheck the final model-visible set after every processor has run. */
export async function filterToolsByPolicy<T extends Record<string, any> | undefined>(
  tools: T,
  policy: ToolPolicy | undefined,
  requestContext?: RequestContext,
): Promise<T> {
  if (!policy || !tools) return tools;
  let filtered = tools;
  for (const [toolName, tool] of Object.entries(tools)) {
    const decision = await policy({
      toolName,
      requestContext,
      phase: 'active',
      hasExecute: typeof tool.execute === 'function',
    });
    if (!decision.allowed) {
      if (filtered === tools) filtered = { ...tools };
      delete filtered[toolName];
    }
  }
  return filtered;
}

/** Global policy runs first; a local policy may only add restrictions. */
export function combineToolPolicies(globalPolicy?: ToolPolicy, localPolicy?: ToolPolicy): ToolPolicy | undefined {
  if (!globalPolicy || globalPolicy === localPolicy) return localPolicy ?? globalPolicy;
  if (!localPolicy) return globalPolicy;
  return async args => {
    const decision = await globalPolicy(args);
    return decision.allowed ? localPolicy(args) : decision;
  };
}

const PREPARED_TOOL_POLICY = Symbol('mastra.preparedToolPolicy');
export function setPreparedToolPolicy<T extends object>(tools: T, policy?: ToolPolicy): T {
  Object.defineProperty(tools, PREPARED_TOOL_POLICY, { value: policy });
  return tools;
}
export function getPreparedToolPolicy(tools?: object): ToolPolicy | undefined {
  return (tools as any)?.[PREPARED_TOOL_POLICY];
}

export function withToolPolicyInvocation(
  options: MastraToolInvocationOptions | undefined,
  invocation: PolicyInvocation,
): MastraToolInvocationOptions {
  const next = { ...options, [TOOL_EXECUTION_POLICY]: invocation } as MastraToolInvocationOptions;
  if (consumeBuilderValidatedInput(options)) markBuilderValidatedInput(next);
  return next;
}
