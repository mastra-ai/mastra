import type { ToolChoice } from '@internal/ai-sdk-v5';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '../../processors';
import type { DecisionFrame, FlowDecision, FlowPolicy } from '../schemas';
import { FLOW_SIGNALS_VERSION } from '../schemas';

// Internal prototype only. Do not export this from the flow-signals entrypoint
// until another processor mapping proves the same adapter shape.
export type BuildProcessorStepToolPolicyFrameOptions = {
  args: Pick<
    ProcessInputStepArgs,
    'activeTools' | 'messages' | 'resourceId' | 'retryCount' | 'runId' | 'stepNumber' | 'tools'
  >;
  policy: FlowPolicy;
  frameId?: string;
  capabilities?: string[];
};

export type ApplyProcessorStepToolPolicyDecisionOptions = {
  args: Pick<ProcessInputStepArgs, 'abort' | 'activeTools' | 'toolChoice' | 'tools'>;
  decision: FlowDecision;
};

export function buildProcessorStepToolPolicyDecisionFrame({
  args,
  policy,
  frameId,
  capabilities,
}: BuildProcessorStepToolPolicyFrameOptions): DecisionFrame {
  const toolNames = Object.keys(args.tools ?? {});
  const messageRefs = args.messages.map(message => ({
    id: message.id,
    kind: 'message' as const,
  }));
  const firstThreadId = args.messages.find(message => message.threadId)?.threadId;

  return {
    version: FLOW_SIGNALS_VERSION,
    id: frameId ?? `processor-step:${args.runId ?? 'run'}:${args.stepNumber}:tool-policy`,
    decisionPoint: args.stepNumber === 0 ? 'turn_start' : 'post_tool_batch',
    request: {
      runId: args.runId,
      threadId: firstThreadId,
      resourceId: args.resourceId,
      featureFlags: [],
    },
    signals: {
      version: FLOW_SIGNALS_VERSION,
      sources: ['system_state'],
      tasks: [],
      requestedOutput: {},
      requestedCapabilities: [],
      entities: {
        documents: [],
        toolRefs: toolNames,
        urls: [],
        identifiers: [],
      },
      ambiguity: {
        status: 'clear',
        blocking: false,
      },
    },
    state: {
      version: FLOW_SIGNALS_VERSION,
      runId: args.runId,
      revision: args.stepNumber,
      retryCount: args.retryCount,
      capabilities: capabilities ?? [],
      decisions: [],
      evidence: {
        version: FLOW_SIGNALS_VERSION,
        entries: [],
      },
      refs: messageRefs,
    },
    refs: messageRefs,
  };
}

export function applyProcessorStepToolPolicyDecision({
  args,
  decision,
}: ApplyProcessorStepToolPolicyDecisionOptions): ProcessInputStepResult {
  for (const action of decision.actions) {
    if (action.type === 'ask_clarification') {
      args.abort(action.question ?? 'Flow decision requires clarification', {
        retry: false,
        metadata: { flowDecisionId: decision.id, flowAction: action.type },
      });
    }

    if (action.type === 'require_capability') {
      args.abort(`Flow decision requires capabilities: ${action.capabilities.join(', ')}`, {
        retry: false,
        metadata: { flowDecisionId: decision.id, flowAction: action.type, capabilities: action.capabilities },
      });
    }

    if (action.type === 'require_evidence') {
      args.abort('Flow decision requires evidence before continuing', {
        retry: false,
        metadata: { flowDecisionId: decision.id, flowAction: action.type, requirements: action.requirements },
      });
    }

    if (action.type === 'retry') {
      args.abort(action.reason, {
        retry: true,
        metadata: { flowDecisionId: decision.id, flowAction: action.type },
      });
    }

    if (action.type === 'fail') {
      args.abort(action.reason, {
        retry: false,
        metadata: { flowDecisionId: decision.id, flowAction: action.type },
      });
    }
  }

  const result: ProcessInputStepResult = {};

  for (const action of decision.actions) {
    if (action.type !== 'apply_tool_policy') {
      continue;
    }

    if (args.tools) {
      const nextTools: Record<string, unknown> = {};
      for (const [toolName, tool] of Object.entries(args.tools)) {
        const allowedByList = action.allowedTools.length === 0 || action.allowedTools.includes(toolName);
        const deniedByList = action.deniedTools.includes(toolName);
        if (allowedByList && !deniedByList) {
          nextTools[toolName] = tool;
        }
      }
      result.tools = nextTools;
    }

    if (args.activeTools) {
      result.activeTools = args.activeTools.filter(toolName => {
        const allowedByList = action.allowedTools.length === 0 || action.allowedTools.includes(toolName);
        const deniedByList = action.deniedTools.includes(toolName);
        return allowedByList && !deniedByList;
      });
    }

    if (isToolChoiceBlockedByFlowPolicy(args.toolChoice, action.allowedTools, action.deniedTools)) {
      result.toolChoice = 'auto';
    }
  }

  return result;
}

function isToolChoiceBlockedByFlowPolicy(
  toolChoice: ToolChoice<any> | undefined,
  allowedTools: string[],
  deniedTools: string[],
): boolean {
  if (!toolChoice || typeof toolChoice !== 'object' || !('toolName' in toolChoice)) {
    return false;
  }

  const toolName = toolChoice.toolName;
  if (typeof toolName !== 'string') {
    return false;
  }

  if (deniedTools.includes(toolName)) {
    return true;
  }

  return allowedTools.length > 0 && !allowedTools.includes(toolName);
}
