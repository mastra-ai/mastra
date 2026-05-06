import { z } from 'zod/v4';

export const FLOW_SIGNALS_VERSION = 1 as const;
export const FLOW_STATE_SNAPSHOT_KEY = 'mastra__flowState' as const;

export const FlowDecisionPointSchema = z.enum([
  'turn_start',
  'post_tool_batch',
  'hitl_suspend',
  'hitl_resume',
  'delegation_entry',
  'delegation_return',
  'retry_after_tripwire',
  'tool_failure',
  'structured_output_failure',
  'pre_final',
]);

export const FlowSignalSourceSchema = z.enum([
  'user_message',
  'ui_action',
  'route_metadata',
  'tool_result',
  'system_state',
]);

export const FlowOutputFormatSchema = z.enum(['plain', 'markdown', 'table', 'json', 'artifact']);

export const FlowRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['message', 'tool_call', 'tool_result', 'source', 'file', 'artifact', 'approval', 'state']),
  hash: z.string().min(1).optional(),
  uri: z.string().min(1).optional(),
});

export const FlowRequestedOutputSchema = z
  .object({
    format: FlowOutputFormatSchema.optional(),
    artifactType: z.string().min(1).optional(),
    contractId: z.string().min(1).optional(),
  })
  .strict();

export const FlowSignalsSchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    sources: z.array(FlowSignalSourceSchema).min(1),
    tasks: z.array(z.string().min(1)).default([]),
    requestedOutput: FlowRequestedOutputSchema.default({}),
    requestedCapabilities: z.array(z.string().min(1)).default([]),
    entities: z
      .object({
        documents: z.array(z.string().min(1)).default([]),
        toolRefs: z.array(z.string().min(1)).default([]),
        urls: z.array(z.string().min(1)).default([]),
        identifiers: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({ documents: [], toolRefs: [], urls: [], identifiers: [] }),
    ambiguity: z
      .object({
        status: z.enum(['clear', 'ambiguous']),
        blocking: z.boolean(),
        clarificationQuestion: z.string().min(1).optional(),
      })
      .strict()
      .default({ status: 'clear', blocking: false }),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const EvidenceKindSchema = z.enum([
  'grounding',
  'retrieval',
  'tool_result',
  'source',
  'file',
  'artifact',
  'approval',
  'schema',
  'validation',
]);

export const EvidenceStatusSchema = z.enum(['observed', 'accepted', 'rejected']);

const EvidenceMatchSchema = z
  .object({
    toolName: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    artifactType: z.string().min(1).optional(),
    validationType: z.string().min(1).optional(),
  })
  .strict();

export const EvidenceRequirementSchema = z
  .object({
    id: z.string().min(1),
    kind: EvidenceKindSchema,
    requiredCount: z.number().int().positive().default(1),
    match: EvidenceMatchSchema.default({}),
  })
  .strict();

export const EvidenceEntrySchema = z
  .object({
    id: z.string().min(1),
    kind: EvidenceKindSchema,
    status: EvidenceStatusSchema.default('observed'),
    ref: FlowRefSchema.optional(),
    toolName: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    artifactType: z.string().min(1).optional(),
    validationType: z.string().min(1).optional(),
    count: z.number().int().positive().optional(),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  })
  .strict();

export const EvidenceLedgerSchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    entries: z.array(EvidenceEntrySchema).default([]),
  })
  .strict();

export const FlowPolicySchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    id: z.string().min(1),
    requiredCapabilities: z.array(z.string().min(1)).default([]),
    allowedTools: z.array(z.string().min(1)).default([]),
    deniedTools: z.array(z.string().min(1)).default([]),
    requiredEvidence: z.array(EvidenceRequirementSchema).default([]),
    outputContractId: z.string().min(1).optional(),
    maxRetries: z.number().int().nonnegative().optional(),
    clarificationRequired: z.boolean().default(false),
  })
  .strict()
  .superRefine((policy, ctx) => {
    const allowedTools = new Set(policy.allowedTools);

    for (const deniedTool of policy.deniedTools) {
      if (allowedTools.has(deniedTool)) {
        ctx.addIssue({
          code: 'custom',
          message: `Tool "${deniedTool}" cannot be both allowed and denied`,
          path: ['deniedTools'],
        });
      }
    }
  });

export const FlowDecisionActionTypeSchema = z.enum([
  'continue',
  'ask_clarification',
  'require_capability',
  'apply_tool_policy',
  'require_evidence',
  'apply_output_contract',
  'retry',
  'fail',
  'finalize',
]);

export const FlowDecisionActionSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('continue') }).strict(),
    z.object({ type: z.literal('ask_clarification'), question: z.string().min(1).optional() }).strict(),
    z.object({ type: z.literal('require_capability'), capabilities: z.array(z.string().min(1)).min(1) }).strict(),
    z
      .object({
        type: z.literal('apply_tool_policy'),
        allowedTools: z.array(z.string().min(1)),
        deniedTools: z.array(z.string().min(1)),
      })
      .strict(),
    z.object({ type: z.literal('require_evidence'), requirements: z.array(EvidenceRequirementSchema).min(1) }).strict(),
    z.object({ type: z.literal('apply_output_contract'), contractId: z.string().min(1) }).strict(),
    z.object({ type: z.literal('retry'), reason: z.string().min(1) }).strict(),
    z.object({ type: z.literal('fail'), reason: z.string().min(1) }).strict(),
    z.object({ type: z.literal('finalize'), contractId: z.string().min(1).optional() }).strict(),
  ])
  .superRefine((action, ctx) => {
    if (action.type !== 'apply_tool_policy') {
      return;
    }

    if (action.allowedTools.length === 0 && action.deniedTools.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'apply_tool_policy requires at least one allowed or denied tool',
        path: ['allowedTools'],
      });
    }

    const allowedTools = new Set(action.allowedTools);

    for (const deniedTool of action.deniedTools) {
      if (allowedTools.has(deniedTool)) {
        ctx.addIssue({
          code: 'custom',
          message: `Tool "${deniedTool}" cannot be both allowed and denied`,
          path: ['deniedTools'],
        });
      }
    }
  });

export const FlowDecisionSchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    id: z.string().min(1),
    frameId: z.string().min(1),
    policyId: z.string().min(1),
    decisionPoint: FlowDecisionPointSchema,
    status: z.enum(['continue', 'blocked', 'retry', 'failed', 'finalize']),
    actions: z.array(FlowDecisionActionSchema).min(1),
    reasons: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((decision, ctx) => {
    const expectedStatus = getFlowDecisionStatus(decision.actions);
    if (decision.status !== expectedStatus) {
      ctx.addIssue({
        code: 'custom',
        message: `Flow decision status must be ${expectedStatus} for its actions`,
        path: ['status'],
      });
    }

    const hasContinue = decision.actions.some(action => action.type === 'continue');
    if (hasContinue && decision.actions.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Flow decision continue action cannot be combined with other actions',
        path: ['actions'],
      });
    }

    const terminalActionTypes = new Set(
      decision.actions
        .filter(action => action.type === 'fail' || action.type === 'retry' || action.type === 'finalize')
        .map(action => action.type),
    );

    if (terminalActionTypes.size > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Flow decision cannot contain multiple terminal action types',
        path: ['actions'],
      });
    }

    const hasFinalize = decision.actions.some(action => action.type === 'finalize');
    const hasBlockingAction = decision.actions.some(
      action =>
        action.type === 'ask_clarification' ||
        action.type === 'require_capability' ||
        action.type === 'require_evidence',
    );

    if (hasFinalize && hasBlockingAction) {
      ctx.addIssue({
        code: 'custom',
        message: 'Flow decision finalize action cannot be combined with blocking actions',
        path: ['actions'],
      });
    }
  });

type FlowDecisionStatus = 'continue' | 'blocked' | 'retry' | 'failed' | 'finalize';

function getFlowDecisionStatus(actions: FlowDecisionAction[]): FlowDecisionStatus {
  if (actions.some(action => action.type === 'fail')) {
    return 'failed';
  }

  if (
    actions.some(
      action =>
        action.type === 'ask_clarification' ||
        action.type === 'require_capability' ||
        action.type === 'require_evidence',
    )
  ) {
    return 'blocked';
  }

  if (actions.some(action => action.type === 'retry')) {
    return 'retry';
  }

  if (actions.some(action => action.type === 'finalize')) {
    return 'finalize';
  }

  return 'continue';
}

export const FlowDecisionSummarySchema = z
  .object({
    id: z.string().min(1),
    policyId: z.string().min(1),
    decisionPoint: FlowDecisionPointSchema,
    status: z.enum(['continue', 'blocked', 'retry', 'failed', 'finalize']),
    actionTypes: z.array(FlowDecisionActionTypeSchema).default([]),
  })
  .strict();

export const FlowStateSchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    runId: z.string().min(1).optional(),
    revision: z.number().int().nonnegative().default(0),
    retryCount: z.number().int().nonnegative().default(0),
    capabilities: z.array(z.string().min(1)).default([]),
    activeDecisionId: z.string().min(1).optional(),
    decisions: z.array(FlowDecisionSummarySchema).default([]),
    evidence: EvidenceLedgerSchema.default({ version: FLOW_SIGNALS_VERSION, entries: [] }),
    refs: z.array(FlowRefSchema).default([]),
  })
  .strict();

export const DecisionFrameSchema = z
  .object({
    version: z.literal(FLOW_SIGNALS_VERSION),
    id: z.string().min(1),
    decisionPoint: FlowDecisionPointSchema,
    request: z
      .object({
        runId: z.string().min(1).optional(),
        threadId: z.string().min(1).optional(),
        resourceId: z.string().min(1).optional(),
        userId: z.string().min(1).optional(),
        tenantId: z.string().min(1).optional(),
        locale: z.string().min(1).optional(),
        featureFlags: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({ featureFlags: [] }),
    signals: FlowSignalsSchema,
    state: FlowStateSchema,
    refs: z.array(FlowRefSchema).default([]),
  })
  .strict();

export type FlowDecisionPoint = z.infer<typeof FlowDecisionPointSchema>;
export type FlowSignalSource = z.infer<typeof FlowSignalSourceSchema>;
export type FlowOutputFormat = z.infer<typeof FlowOutputFormatSchema>;
export type FlowRequestedOutput = z.infer<typeof FlowRequestedOutputSchema>;
export type FlowSignals = z.infer<typeof FlowSignalsSchema>;
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;
export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;
export type EvidenceLedger = z.infer<typeof EvidenceLedgerSchema>;
export type FlowPolicy = z.infer<typeof FlowPolicySchema>;
export type FlowDecisionActionType = z.infer<typeof FlowDecisionActionTypeSchema>;
export type FlowDecisionAction = z.infer<typeof FlowDecisionActionSchema>;
export type FlowDecision = z.infer<typeof FlowDecisionSchema>;
export type FlowDecisionSummary = z.infer<typeof FlowDecisionSummarySchema>;
export type FlowState = z.infer<typeof FlowStateSchema>;
export type DecisionFrame = z.infer<typeof DecisionFrameSchema>;
export type FlowRef = z.infer<typeof FlowRefSchema>;
