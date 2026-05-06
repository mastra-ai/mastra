import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import type { ProcessInputStepArgs, Processor } from '../../processors';
import type { FlowPolicy } from '../schemas';
import { selectFlowDecision } from '../selector';
import { applyProcessorStepToolPolicyDecision, buildProcessorStepToolPolicyDecisionFrame } from './processor-step-tool-policy';

const basePolicy: FlowPolicy = {
  version: 1,
  id: 'flow-policy.tools',
  requiredCapabilities: [],
  allowedTools: ['search'],
  deniedTools: ['send_email'],
  requiredEvidence: [],
  maxRetries: 1,
  clarificationRequired: false,
};

class TestTripWire extends Error {
  constructor(
    reason: string,
    public readonly options: unknown,
  ) {
    super(reason);
  }
}

function createMessage(): MastraDBMessage {
  return {
    id: 'message-1',
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'Search but do not email anyone.' }],
    },
    createdAt: new Date('2026-05-06T00:00:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
  };
}

function createProcessorArgs(
  overrides: Partial<ProcessInputStepArgs> = {},
): Pick<
  ProcessInputStepArgs,
  | 'abort'
  | 'activeTools'
  | 'messages'
  | 'resourceId'
  | 'retryCount'
  | 'runId'
  | 'stepNumber'
  | 'toolChoice'
  | 'tools'
> {
  const message = createMessage();

  return {
    abort: (reason?: string, options?: any): never => {
      throw new TestTripWire(reason ?? 'Flow decision aborted', options);
    },
    activeTools: ['search', 'send_email'],
    messages: [message],
    resourceId: 'resource-1',
    retryCount: 0,
    runId: 'run-1',
    stepNumber: 0,
    toolChoice: { type: 'tool', toolName: 'send_email' } as any,
    tools: {
      search: { description: 'Search documents' },
      send_email: { description: 'Send email' },
    },
    ...overrides,
  };
}

describe('processor step Flow Signals tool policy mapping', () => {
  it('maps processor step state into a DecisionFrame and consumes the decision as processor output', async () => {
    const processor: Processor = {
      id: 'flow-tool-policy-prototype',
      processInputStep: async args => {
        const frame = buildProcessorStepToolPolicyDecisionFrame({ args, policy: basePolicy });
        const decision = selectFlowDecision(frame, basePolicy);
        return applyProcessorStepToolPolicyDecision({ args, decision });
      },
    };

    const result = await processor.processInputStep!(createProcessorArgs() as ProcessInputStepArgs);

    expect(result).toEqual({
      tools: {
        search: { description: 'Search documents' },
      },
      activeTools: ['search'],
      toolChoice: 'auto',
    });
  });

  it('keeps the DecisionFrame tied to processor lifecycle data', () => {
    const args = createProcessorArgs({ stepNumber: 2 });
    const frame = buildProcessorStepToolPolicyDecisionFrame({ args, policy: basePolicy });

    expect(frame).toMatchObject({
      id: 'processor-step:run-1:2:tool-policy',
      decisionPoint: 'post_tool_batch',
      request: {
        runId: 'run-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
      signals: {
        entities: {
          toolRefs: ['search', 'send_email'],
        },
      },
      state: {
        revision: 2,
        retryCount: 0,
      },
      refs: [{ id: 'message-1', kind: 'message' }],
    });
  });

  it('maps blocking Flow decisions to the existing processor abort path', () => {
    const policy: FlowPolicy = {
      ...basePolicy,
      id: 'flow-policy.evidence',
      allowedTools: [],
      deniedTools: [],
      requiredEvidence: [{ id: 'retrieval.evidence', kind: 'retrieval', requiredCount: 1, match: {} }],
    };
    const args = createProcessorArgs();
    const frame = buildProcessorStepToolPolicyDecisionFrame({ args, policy });
    const decision = selectFlowDecision(frame, policy);

    expect(() => applyProcessorStepToolPolicyDecision({ args, decision })).toThrow(TestTripWire);

    try {
      applyProcessorStepToolPolicyDecision({ args, decision });
      expect.fail('Expected a TripWire');
    } catch (error) {
      expect(error).toBeInstanceOf(TestTripWire);
      expect((error as TestTripWire).message).toBe('Flow decision requires evidence before continuing');
      expect((error as TestTripWire).options).toMatchObject({
        retry: false,
        metadata: {
          flowDecisionId: decision.id,
          flowAction: 'require_evidence',
        },
      });
    }
  });

  it('does not claim policy-required capabilities unless runtime capabilities are supplied', () => {
    const policy: FlowPolicy = {
      ...basePolicy,
      id: 'flow-policy.capability',
      allowedTools: [],
      deniedTools: [],
      requiredCapabilities: ['retrieval'],
    };
    const args = createProcessorArgs();
    const frame = buildProcessorStepToolPolicyDecisionFrame({ args, policy });
    const decision = selectFlowDecision(frame, policy);

    expect(() => applyProcessorStepToolPolicyDecision({ args, decision })).toThrow(TestTripWire);

    const frameWithCapability = buildProcessorStepToolPolicyDecisionFrame({
      args,
      policy,
      capabilities: ['retrieval'],
    });
    const decisionWithCapability = selectFlowDecision(frameWithCapability, policy);

    expect(decisionWithCapability.actions.some(action => action.type === 'require_capability')).toBe(false);
  });

  it('clears denied object tool choices that omit an explicit type discriminator', () => {
    const args = createProcessorArgs({
      toolChoice: { toolName: 'send_email' } as any,
    });
    const frame = buildProcessorStepToolPolicyDecisionFrame({ args, policy: basePolicy });
    const decision = selectFlowDecision(frame, basePolicy);
    const result = applyProcessorStepToolPolicyDecision({ args, decision });

    expect(result.toolChoice).toBe('auto');
  });
});
