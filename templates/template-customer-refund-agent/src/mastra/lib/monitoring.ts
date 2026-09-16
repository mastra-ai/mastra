import type { Mastra } from "@mastra/core/mastra";
import { caseStore } from "./case-store";
import { legacyAmountToMoney } from "./money";
import type { SupportCase } from "../domain/support-case";
import { bindingsForCase } from "../providers/contracts";
import { alertReasons } from "./operational-alerts";

type Availability<T> = T | null;
type StoredSpan = {
  name: string;
  spanType: string;
  startedAt?: Date;
  endedAt?: Date | null;
  startTime?: Date;
  endTime?: Date | null;
  error?: unknown;
  attributes?: unknown;
};

function minutesBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000;
}
function numberAt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
function recordAt(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export interface CaseFunnelMetrics {
  totalCases: number;
  new: number;
  processing: number;
  waitingApproval: number;
  resolved: number;
  escalated: number;
  failed: number;
  containmentRate: Availability<number>;
  escalationRate: Availability<number>;
  avgResolutionMinutes: Availability<number>;
}
export interface CurrencyTotal {
  currency: string;
  minor: number;
}
export interface RefundApprovalMetrics {
  recommended: number;
  approved: number;
  rejected: number;
  executed: number;
  failed: number;
  autoEscalated: number;
  approvalRate: Availability<number>;
  /** Exact minor-unit totals; different currencies are never added together. */
  executedTotals: CurrencyTotal[];
}
export interface FeedbackMetrics {
  totalResponses: number;
  up: number;
  down: number;
  satisfactionRate: Availability<number>;
  recent: Array<{
    caseId: string;
    subject: string;
    rating: "up" | "down";
    submittedAt: string;
    turnId?: string;
    runId?: string;
    traceId?: string;
  }>;
}
export interface ModelUsageMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicrosUsd: Availability<number>;
}
export interface OperationMetrics {
  operation: string;
  calls: number;
  errorRate: Availability<number>;
  p95Ms: Availability<number>;
}
export interface MonitoringSummary {
  generatedAt: string;
  casesConsidered: number;
  funnel: CaseFunnelMetrics;
  refunds: RefundApprovalMetrics;
  credits: RefundApprovalMetrics;
  feedback: FeedbackMetrics;
  telemetry: {
    observedTraces: number;
    observedSpans: number;
    providerOrToolErrorRate: Availability<number>;
    providerOrToolP95Ms: Availability<number>;
    modelUsage: ModelUsageMetrics[];
    workflowStages: OperationMetrics[];
    providerCalls: OperationMetrics[];
    toolCalls: OperationMetrics[];
    unavailable: string[];
    alerts: string[];
  };
  failures: {
    rejectedDecisions: number;
    workflow: number;
    financial: number;
    delivery: number;
  };
}

function percentile95(values: number[]): Availability<number> {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1]! : null;
}
function durationMs(span: StoredSpan) {
  const startedAt = span.startedAt ?? span.startTime;
  const endedAt = span.endedAt ?? span.endTime;
  return startedAt && endedAt
    ? Math.max(0, endedAt.getTime() - startedAt.getTime())
    : undefined;
}
function operationMetrics(spans: StoredSpan[]): OperationMetrics[] {
  const grouped = new Map<string, StoredSpan[]>();
  for (const span of spans)
    grouped.set(span.name, [...(grouped.get(span.name) ?? []), span]);
  return [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([operation, entries]) => ({
      operation,
      calls: entries.length,
      // The redactor leaves undefined absent. A redacted non-null error remains
      // a true error without exporting prose or credentials.
      errorRate:
        entries.filter(
          (span) => span.error !== undefined && span.error !== null,
        ).length / entries.length,
      p95Ms: percentile95(
        entries
          .map(durationMs)
          .filter((value): value is number => value !== undefined),
      ),
    }));
}

async function readTrustedSpanMetrics(
  mastra: Mastra,
  tenantId: string,
  cases: SupportCase[],
) {
  const observability = await mastra.getStorage()?.getStore("observability");
  const traceIds = new Set<string>();
  const supervisorExecutions =
    await caseStore.supervisorExecutionsForMonitoring(
      tenantId,
      cases.map((supportCase) => supportCase.id),
    );
  for (const supportCase of cases) {
    for (const turn of await caseStore.turns(supportCase.id)) {
      const telemetry = recordAt(turn.outcome?.telemetry);
      if (typeof telemetry?.traceId === "string")
        traceIds.add(telemetry.traceId);
    }
    // Compatibility for pre-turn-telemetry records; normal paths only use a
    // turn reference and later projections cannot overwrite it.
    if (supportCase.traceId) traceIds.add(supportCase.traceId);
  }
  for (const execution of supervisorExecutions)
    if (execution.traceId) traceIds.add(execution.traceId);
  if (!observability)
    return {
      observedTraces: 0,
      observedSpans: 0,
      providerOrToolErrorRate: null,
      providerOrToolP95Ms: null,
      modelUsage: [],
      workflowStages: [],
      providerCalls: [],
      toolCalls: [],
      unavailable: ["observability-storage"],
      alerts: [],
    };
  const traceResults = await Promise.allSettled(
    [...traceIds].map((traceId) => observability.getTrace({ traceId })),
  );
  const traces = traceResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
  const traceReadFailures = traceResults.filter(
    (result) => result.status === "rejected" || !result.value,
  ).length;
  const spans = traces.flatMap((trace) => trace.spans ?? []) as StoredSpan[];
  const operational = spans.filter((span) => {
    const metadata = recordAt((span as { metadata?: unknown }).metadata);
    return (
      metadata?.operationalKind === "provider" ||
      metadata?.operationalKind === "tool"
    );
  });
  const models = spans.filter((span) => span.spanType === "model_generation");
  const modelUsage = new Map<string, ModelUsageMetrics>();
  for (const span of models) {
    const attributes = recordAt(span.attributes);
    const model =
      typeof attributes?.responseModel === "string"
        ? attributes.responseModel
        : typeof attributes?.model === "string"
          ? attributes.model
          : "unknown";
    const usage = recordAt(attributes?.usage);
    const inputTokens = numberAt(usage?.inputTokens);
    const outputTokens = numberAt(usage?.outputTokens);
    const costContext = recordAt(attributes?.costContext);
    const estimatedCost = numberAt(costContext?.estimatedCost);
    const costUnit =
      typeof costContext?.costUnit === "string"
        ? costContext.costUnit.toUpperCase()
        : undefined;
    // Native Mastra pricing emits a currency-unit estimate. Monitoring's API
    // intentionally exposes micro-USD; never invent a conversion for an
    // unknown unit/currency.
    const cost =
      estimatedCost !== undefined && (!costUnit || costUnit === "USD")
        ? Math.round(estimatedCost * 1_000_000)
        : undefined;
    if (inputTokens === undefined || outputTokens === undefined) continue;
    const current = modelUsage.get(model) ?? {
      model,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostMicrosUsd: 0,
    };
    current.inputTokens += inputTokens;
    current.outputTokens += outputTokens;
    current.estimatedCostMicrosUsd =
      current.estimatedCostMicrosUsd === null || cost === undefined
        ? null
        : current.estimatedCostMicrosUsd + cost;
    modelUsage.set(model, current);
  }
  return {
    observedTraces: traces.filter(Boolean).length,
    observedSpans: spans.length,
    providerOrToolErrorRate: operational.length
      ? operational.filter(
          (span) => span.error !== undefined && span.error !== null,
        ).length / operational.length
      : null,
    providerOrToolP95Ms: percentile95(
      operational
        .map(durationMs)
        .filter((value): value is number => value !== undefined),
    ),
    modelUsage: [...modelUsage.values()].sort((a, b) =>
      a.model.localeCompare(b.model),
    ),
    workflowStages: operationMetrics(
      spans.filter((span) => span.spanType === "workflow_step"),
    ),
    providerCalls: operationMetrics(
      spans.filter(
        (span) =>
          recordAt((span as { metadata?: unknown }).metadata)
            ?.operationalKind === "provider",
      ),
    ),
    toolCalls: operationMetrics(
      spans.filter(
        (span) =>
          recordAt((span as { metadata?: unknown }).metadata)
            ?.operationalKind === "tool",
      ),
    ),
    unavailable: [
      ...(traceIds.size === 0 ? ["trace-correlation"] : []),
      ...(supervisorExecutions.some((execution) => !execution.traceId)
        ? ["partial-supervisor-trace-correlation"]
        : []),
      ...(traceReadFailures > 0 ? ["partial-trace-read"] : []),
      ...(models.length === 0 ? ["model-usage"] : []),
      ...(models.some((span) => {
        const usage = recordAt(recordAt(span.attributes)?.usage);
        return (
          numberAt(usage?.inputTokens) === undefined ||
          numberAt(usage?.outputTokens) === undefined
        );
      })
        ? ["partial-model-usage"]
        : []),
      ...(models.some((span) => {
        const costContext = recordAt(recordAt(span.attributes)?.costContext);
        const estimatedCost = numberAt(costContext?.estimatedCost);
        const unit =
          typeof costContext?.costUnit === "string"
            ? costContext.costUnit.toUpperCase()
            : undefined;
        return estimatedCost === undefined || Boolean(unit && unit !== "USD");
      })
        ? ["partial-model-cost"]
        : []),
    ],
    alerts: alertReasons(
      operational.map((span) => ({
        providerOrTool: span.name,
        occurredAt: span.startedAt ?? span.startTime ?? new Date(0),
        durationMs: durationMs(span) ?? 0,
        failed: span.error !== undefined && span.error !== null,
      })),
    ),
  };
}

export function computeCaseFunnelMetrics(
  cases: SupportCase[],
): CaseFunnelMetrics {
  const byStatus = {
    new: 0,
    processing: 0,
    waiting_approval: 0,
    resolved: 0,
    escalated: 0,
    failed: 0,
  };
  for (const supportCase of cases) byStatus[supportCase.status] += 1;
  const decided = byStatus.resolved + byStatus.escalated;
  const durations = cases
    .filter((item) => item.status === "resolved" || item.status === "escalated")
    .map((item) => minutesBetween(item.createdAt, item.updatedAt))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return {
    totalCases: cases.length,
    new: byStatus.new,
    processing: byStatus.processing,
    waitingApproval: byStatus.waiting_approval,
    resolved: byStatus.resolved,
    escalated: byStatus.escalated,
    failed: byStatus.failed,
    containmentRate: decided ? byStatus.resolved / decided : null,
    escalationRate: decided ? byStatus.escalated / decided : null,
    avgResolutionMinutes: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
  };
}
function refundResult(value: unknown) {
  const item = recordAt(value);
  if (
    !item ||
    typeof item.currency !== "string" ||
    typeof item.amount !== "number" ||
    !Number.isFinite(item.amount)
  )
    return undefined;
  try {
    return {
      status: item.status,
      idempotencyKey: item.idempotencyKey,
      creditId: item.creditId,
      customerId: item.customerId,
      subscriptionId: item.subscriptionId,
      executedAt: item.executedAt,
      ...legacyAmountToMoney(item.amount, item.currency),
    };
  } catch {
    return undefined;
  }
}

async function confirmedRecoveredEffect(
  result: ReturnType<typeof refundResult>,
) {
  if (result?.status !== "skipped" || !result.idempotencyKey) return false;
  const durable = await caseStore.idempotency(String(result.idempotencyKey));
  const effect = recordAt(durable?.effect);
  return (
    Boolean(effect) &&
    effect?.status === "succeeded" &&
    typeof effect?.creditId === "string" &&
    effect.creditId === result.creditId &&
    effect.customerId === result.customerId &&
    effect.subscriptionId === result.subscriptionId &&
    effect.idempotencyKey === result.idempotencyKey &&
    effect.executedAt === result.executedAt &&
    recordAt(effect.amount)?.currency === result.currency &&
    recordAt(effect.amount)?.minor === result.minor
  );
}
export async function computeRefundApprovalMetrics(
  cases: SupportCase[],
): Promise<RefundApprovalMetrics> {
  return computeFinancialApprovalMetrics(cases, {
    actionKind: "refund-command",
    failureKind: "refund",
    recommended: (draft) => draft?.recommendRefund === true,
    resultKey: "refundResult",
    effectsKey: "refundEffects",
  });
}

/** Credits have their own immutable command and receipt projection. Keeping
 * them separate prevents a credit approval or provider failure from changing
 * the refund rate shown to operators. */
export async function computeSubscriptionCreditMetrics(
  cases: SupportCase[],
): Promise<RefundApprovalMetrics> {
  return computeFinancialApprovalMetrics(cases, {
    actionKind: "subscription-credit-command",
    failureKind: "subscription-credit",
    recommended: (draft) => draft?.resolutionAction === "subscription_credit",
    resultKey: "subscriptionCreditResult",
    effectsKey: "subscriptionCreditEffects",
  });
}

async function computeFinancialApprovalMetrics(
  cases: SupportCase[],
  options: {
    actionKind: string;
    failureKind: string;
    recommended: (draft: Record<string, unknown> | undefined) => boolean;
    resultKey: "refundResult" | "subscriptionCreditResult";
    effectsKey: "refundEffects" | "subscriptionCreditEffects";
  },
): Promise<RefundApprovalMetrics> {
  let recommended = 0,
    autoEscalated = 0,
    executed = 0;
  const totals = new Map<string, number>();
  const effectKeys = new Set<string>();
  for (const supportCase of cases) {
    const turns = await caseStore.turns(supportCase.id);
    for (const turn of turns) {
      const activeTurnId = supportCase.metadata.activeTurnId;
      const draft =
        recordAt(turn.outcome?.draft) ??
        (activeTurnId === turn.id ? recordAt(supportCase.draft) : undefined);
      if (options.recommended(draft)) recommended += 1;
      if (
        turn.outcome?.status === "escalated" &&
        options.recommended(draft) &&
        !recordAt(turn.outcome?.approval)
      )
        autoEscalated += 1;
      const result = refundResult(turn.outcome?.[options.resultKey]);
      if (
        result &&
        (result.status === "executed" ||
          (await confirmedRecoveredEffect(result)))
      ) {
        const key = String(result.idempotencyKey ?? turn.id);
        if (!effectKeys.has(key)) {
          effectKeys.add(key);
          executed += 1;
          totals.set(
            result.currency,
            (totals.get(result.currency) ?? 0) + result.minor,
          );
        }
      }
    }
    const effects = recordAt(supportCase.metadata[options.effectsKey]);
    for (const effect of Object.values(effects ?? {})) {
      const result = refundResult(effect);
      const key = String(result?.idempotencyKey ?? "");
      if (
        result &&
        (result.status === "executed" ||
          (await confirmedRecoveredEffect(result))) &&
        key &&
        !effectKeys.has(key)
      ) {
        effectKeys.add(key);
        executed += 1;
        totals.set(
          result.currency,
          (totals.get(result.currency) ?? 0) + result.minor,
        );
      }
    }
    if (!turns.length && options.recommended(recordAt(supportCase.draft)))
      recommended += 1;
  }
  const decisions = await caseStore.monitoringDecisions(
    cases.map((item) => item.id),
    options.actionKind,
  );
  const approved = decisions.filter((item) => item.approved).length;
  const rejected = decisions.filter((item) => !item.approved).length;
  return {
    recommended,
    approved,
    rejected,
    executed,
    failed: await caseStore.monitoringFinancialFailures(
      cases.map((item) => item.id),
      options.failureKind,
    ),
    autoEscalated,
    approvalRate: approved + rejected ? approved / (approved + rejected) : null,
    executedTotals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, minor]) => ({ currency, minor })),
  };
}
function feedbackMetrics(
  feedback: Array<{
    supportCase: SupportCase;
    value: NonNullable<SupportCase["feedback"]>;
  }>,
): FeedbackMetrics {
  const up = feedback.filter((item) => item.value.rating === "up").length;
  return {
    totalResponses: feedback.length,
    up,
    down: feedback.length - up,
    satisfactionRate: feedback.length ? up / feedback.length : null,
    recent: feedback
      .sort((a, b) => (a.value.submittedAt < b.value.submittedAt ? 1 : -1))
      .slice(0, 10)
      .map((item) => ({
        caseId: item.supportCase.id,
        subject: item.supportCase.subject,
        rating: item.value.rating,
        submittedAt: item.value.submittedAt,
        turnId: item.value.turnId,
        runId: item.value.runId,
        traceId: item.value.traceId,
      })),
  };
}
/** Legacy projection helper retained for direct callers. Monitoring itself
 * reads the durable turn-bound feedback table below. */
export function computeFeedbackMetrics(cases: SupportCase[]): FeedbackMetrics {
  return feedbackMetrics(
    cases.flatMap((supportCase) =>
      supportCase.feedback
        ? [{ supportCase, value: supportCase.feedback }]
        : [],
    ),
  );
}
async function computeHistoricalFeedbackMetrics(
  cases: SupportCase[],
): Promise<FeedbackMetrics> {
  const byCase = new Map(cases.map((item) => [item.id, item]));
  const records = await caseStore.feedback(cases.map((item) => item.id));
  // A migration may leave a retained legacy projection without a correlatable
  // response turn. Keep it for that case even after newer records arrive for
  // other cases; only a durable record for the same case supersedes it.
  const coveredCases = new Set(records.map((record) => record.caseId));
  return feedbackMetrics([
    ...records.map((record) => ({
      supportCase: byCase.get(record.caseId)!,
      value: record.feedback,
    })),
    ...cases.flatMap((supportCase) =>
      !coveredCases.has(supportCase.id) && supportCase.feedback
        ? [{ supportCase, value: supportCase.feedback }]
        : [],
    ),
  ]);
}
export async function computeMonitoringSummary(
  mastra: Mastra,
  tenantId: string,
): Promise<MonitoringSummary> {
  const cases = (await caseStore.list()).filter(
    (supportCase) => bindingsForCase(supportCase).support.tenantId === tenantId,
  );
  const failures = await caseStore.monitoringOperationalFailures(
    cases.map((item) => item.id),
  );
  const telemetry = await readTrustedSpanMetrics(mastra, tenantId, cases);
  if (failures.financial > 0 && !telemetry.alerts.includes("refund-failure"))
    telemetry.alerts.push("refund-failure");
  return {
    generatedAt: new Date().toISOString(),
    casesConsidered: cases.length,
    funnel: computeCaseFunnelMetrics(cases),
    refunds: await computeRefundApprovalMetrics(cases),
    credits: await computeSubscriptionCreditMetrics(cases),
    feedback: await computeHistoricalFeedbackMetrics(cases),
    telemetry,
    failures,
  };
}
