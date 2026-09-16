import { createClient, type Client } from "@libsql/client";
import { waitForMastraStorage } from "../runtime/storage-lifecycle";
import {
  getSharedLocalSqliteClient,
  serializeSqliteClient,
} from "./sqlite-client";
import { resolveDatabaseUrl } from "./database-url";
import { CaseStoreMigrations } from "./case-store-migrations";
import { CaseStoreCases } from "./case-store-cases";
import { CaseStoreFinalization } from "./case-store-finalization";
import { CaseStoreDispatch } from "./case-store-dispatch";
import { CaseStoreTurns } from "./case-store-turns";
import { CaseStoreOutbox } from "./case-store-outbox";
import { CaseStoreActions } from "./case-store-actions";
import { CaseStoreFinancial } from "./case-store-financial";
import { CaseStoreRetention } from "./case-store-retention";
import { CaseStoreCancellation } from "./case-store-cancellation";
import { CaseStoreManualResolution } from "./case-store-manual-resolution";
import { CaseStoreIntercomClose } from "./case-store-intercom-close";
import type {
  CaseFeedback,
  CaseMessage,
  SupportCase,
} from "../domain/support-case";
import type {
  ProviderBinding,
  RefundCommand,
  SubscriptionCancellationCommand,
  SubscriptionCreditCommand,
} from "../providers/contracts";
import type { DispatchLeaseScope } from "./dispatch-lease-scope";
import {
  retentionPolicyFromEnvironment,
  type DispatchRecord,
  type DispatchState,
  type FeedbackRecord,
  type OutboxRecord,
  type RetentionPolicy,
  type RetentionResult,
  type SupervisorExecutionRecord,
  type SupportTurnRecord,
} from "./case-store-shared";

export {
  financialRetentionTombstone,
  isFinancialRetentionTombstone,
  isRetentionTombstone,
  retentionDefaults,
  retentionPolicyFromEnvironment,
  StaleCaseWriteError,
} from "./case-store-shared";
export type {
  DispatchRecord,
  DispatchState,
  FeedbackRecord,
  OutboxOperation,
  OutboxRecord,
  OutboxState,
  RetentionPolicy,
  RetentionResult,
  SupervisorExecutionRecord,
  SupportTurnRecord,
} from "./case-store-shared";

function config(url = resolveDatabaseUrl()) {
  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    ...(url.startsWith("file:") || url.includes(":memory:")
      ? { timeout: 0 }
      : {}),
  };
}

/** App-owned migrations never enumerate, rename, or drop Mastra-owned tables. */
export class CaseStore {
  private readonly client: Client;
  private readonly ownsClient: boolean;
  private ready?: Promise<void>;
  private readonly migrations: CaseStoreMigrations;
  private readonly cases: CaseStoreCases;
  private readonly finalization: CaseStoreFinalization;
  private readonly dispatch: CaseStoreDispatch;
  private readonly turnStore: CaseStoreTurns;
  private readonly outbox: CaseStoreOutbox;
  private readonly actions: CaseStoreActions;
  private readonly financial: CaseStoreFinancial;
  private readonly retention: CaseStoreRetention;
  private readonly cancellation: CaseStoreCancellation;
  private readonly manualResolution: CaseStoreManualResolution;
  private readonly intercomClose: CaseStoreIntercomClose;

  constructor(options: { client?: Client; url?: string } = {}) {
    if (options.client) {
      this.client = serializeSqliteClient(options.client);
      this.ownsClient = true;
    } else if (options.url) {
      this.client = serializeSqliteClient(createClient(config(options.url)));
      this.ownsClient = true;
    } else {
      this.client = getSharedLocalSqliteClient();
      this.ownsClient = false;
    }
    this.migrations = new CaseStoreMigrations(this.client);
    this.cases = new CaseStoreCases(this.client);
    this.finalization = new CaseStoreFinalization(this.client);
    this.dispatch = new CaseStoreDispatch(this.client);
    this.turnStore = new CaseStoreTurns(this.client);
    this.outbox = new CaseStoreOutbox(this.client);
    this.actions = new CaseStoreActions(this.client);
    this.financial = new CaseStoreFinancial(this.client);
    this.retention = new CaseStoreRetention(this.client);
    this.cancellation = new CaseStoreCancellation(this.client);
    this.manualResolution = new CaseStoreManualResolution(this.client);
    this.intercomClose = new CaseStoreIntercomClose(this.client);
  }

  async close() {
    if (this.ownsClient) this.client.close();
  }

  private async ensured() {
    this.ready ??= (async () => {
      await waitForMastraStorage();
      await this.client.execute("PRAGMA journal_mode=WAL;");
      await this.client.execute("PRAGMA busy_timeout = 0;");
      await this.migrate();
    })();
    await this.ready;
  }

  async migrate(target = 26): Promise<void> {
    await this.migrations.migrate(target);
  }

  async manualResolutionContext(caseId: string) {
    await this.ensured();
    return this.manualResolution.context(caseId);
  }

  async resolveManually(input: {
    caseId: string;
    tenantId: string;
    actorId: string;
    expectedVersion: number;
    expectedTurnId: string;
    idempotencyKey: string;
    internalNote: string;
  }) {
    await this.ensured();
    return this.manualResolution.resolve(input);
  }

  async recordIntercomCloseIntent(input: {
    tenantId: string;
    providerAccountId: string;
    eventId: string;
    externalConversationId: string;
  }) {
    await this.ensured();
    return this.intercomClose.record(input);
  }

  async claimIntercomCloseIntents(limit = 10) {
    await this.ensured();
    return this.intercomClose.claim(limit);
  }

  async deferIntercomCloseIntent(
    id: string,
    leaseToken: string,
    error: string,
  ) {
    await this.ensured();
    return this.intercomClose.defer(id, leaseToken, error);
  }

  async completeIntercomCloseIntent(
    id: string,
    leaseToken: string,
    state: "applied" | "superseded",
  ) {
    await this.ensured();
    return this.intercomClose.complete(id, leaseToken, state);
  }

  async applyIntercomClose(input: {
    intentId: string;
    leaseToken: string;
    tenantId: string;
    providerAccountId: string;
    externalConversationId: string;
    expectedVersion: number;
  }) {
    await this.ensured();
    return this.intercomClose.apply(input);
  }

  async findByExternalId(source: string, externalId: string) {
    await this.ensured();
    return this.cases.findByExternalId(source, externalId);
  }

  async get(id: string) {
    await this.ensured();
    return this.cases.get(id);
  }

  async list() {
    await this.ensured();
    return this.cases.list();
  }

  async findConversation(
    tenantId: string,
    externalConversationId: string,
    providerKind = "local",
    providerAccountId = "local-demo",
  ): Promise<SupportCase | undefined> {
    await this.ensured();
    return this.cases.findConversation(
      tenantId,
      externalConversationId,
      providerKind,
      providerAccountId,
    );
  }

  async canonicalConversationOwner(input: {
    caseId: string;
    binding: ProviderBinding;
  }) {
    await this.ensured();
    return this.cases.canonicalConversationOwner(input);
  }

  async conversationSnapshot(
    tenantId: string,
    externalConversationId: string,
    providerKind: string,
    providerAccountId: string,
  ) {
    await this.ensured();
    return this.cases.conversationSnapshot(
      tenantId,
      externalConversationId,
      providerKind,
      providerAccountId,
    );
  }

  async create(case_: SupportCase) {
    await this.ensured();
    return this.cases.create(case_);
  }

  async update(
    id: string,
    patch: Partial<SupportCase>,
    expectedVersion?: number,
  ) {
    await this.ensured();
    return this.cases.update(id, patch, expectedVersion);
  }

  async version(id: string) {
    await this.ensured();
    return this.cases.version(id);
  }

  async appendMessage(id: string, message: CaseMessage) {
    await this.ensured();
    return this.cases.appendMessage(id, message);
  }

  async appendFollowUp(input: {
    caseId: string;
    eventId: string;
    message: CaseMessage;
    runId: string;
    /** Set only by authenticated ingress after owner verification. */
    expectedOwnerId?: string;
  }): Promise<{
    appended: boolean;
    supportCase: SupportCase;
    turnId?: string;
  }> {
    await this.ensured();
    return this.cases.appendFollowUp(input);
  }

  async acceptInbound(case_: SupportCase, eventId: string, runId: string) {
    await this.ensured();
    return this.cases.acceptInbound(case_, eventId, runId);
  }

  async enqueueDelivery(record: Omit<OutboxRecord, "state" | "attempts">) {
    await this.ensured();
    return this.finalization.enqueueDelivery(record);
  }

  async finalizeCaseAndEnqueue(input: {
    caseId: string;
    turnId: string;
    status: "resolved" | "escalated";
    finalResponse: string;
    escalationReason?: string;
    message: CaseMessage;
    outbox: Omit<OutboxRecord, "state" | "attempts">;
    additionalOutbox?: Array<Omit<OutboxRecord, "state" | "attempts">>;
  }) {
    await this.ensured();
    return this.finalization.finalizeCaseAndEnqueue(input);
  }

  async claimDispatch(limit = 10): Promise<DispatchRecord[]> {
    await this.ensured();
    return this.dispatch.claimDispatch(limit);
  }

  async renewDispatchLease(id: string, leaseToken: string) {
    await this.ensured();
    return this.dispatch.renewDispatchLease(id, leaseToken);
  }

  async hasDispatchLease(scope: DispatchLeaseScope) {
    await this.ensured();
    return this.dispatch.hasDispatchLease(scope);
  }

  async authorizeStripeRefundFirstEffect(input: {
    command: RefundCommand;
    request: { paymentIntentId: string; providerRefs: unknown[] };
    ownerId: string;
    dispatch?: DispatchLeaseScope;
    reconciliationLeaseToken?: string;
    validatePolicy: (
      tx: Awaited<ReturnType<Client["transaction"]>>,
    ) => Promise<void>;
  }) {
    await this.ensured();
    return this.dispatch.authorizeStripeRefundFirstEffect(input);
  }

  async authorizeStripeSubscriptionCreditFirstEffect(input: {
    command: SubscriptionCreditCommand;
    dispatch: DispatchLeaseScope;
    validatePolicy: (
      tx: Awaited<ReturnType<Client["transaction"]>>,
    ) => Promise<void>;
  }) {
    await this.ensured();
    return this.dispatch.authorizeStripeSubscriptionCreditFirstEffect(input);
  }

  async authorizeSubscriptionCancellationFirstEffect(input: {
    command: SubscriptionCancellationCommand;
    dispatch: DispatchLeaseScope;
  }) {
    await this.ensured();
    return this.dispatch.authorizeSubscriptionCancellationFirstEffect(input);
  }

  async completeDispatch(
    id: string,
    state: Exclude<DispatchState, "pending" | "claimed">,
    error?: unknown,
    leaseToken?: string,
  ) {
    await this.ensured();
    return this.dispatch.completeDispatch(id, state, error, leaseToken);
  }

  async failDispatchAndCase(
    id: string,
    caseId: string,
    error: unknown,
    leaseToken?: string,
    terminalStatus: "failed" | "escalated" = "failed",
  ) {
    await this.ensured();
    return this.dispatch.failDispatchAndCase(
      id,
      caseId,
      error,
      leaseToken,
      terminalStatus,
    );
  }

  async retryDispatch(
    id: string,
    caseId: string,
    error: unknown,
    leaseToken?: string,
  ) {
    await this.ensured();
    return this.dispatch.retryDispatch(id, caseId, error, leaseToken);
  }

  async markDispatchStarted(dispatchId: string, leaseToken?: string) {
    await this.ensured();
    return this.dispatch.markDispatchStarted(dispatchId, leaseToken);
  }

  async activateDispatch(dispatch: DispatchRecord) {
    await this.ensured();
    return this.dispatch.activateDispatch(dispatch);
  }

  async turns(caseId: string): Promise<SupportTurnRecord[]> {
    await this.ensured();
    return this.turnStore.turns(caseId);
  }

  async turn(
    caseId: string,
    turnId: string,
  ): Promise<SupportTurnRecord | undefined> {
    await this.ensured();
    return this.turnStore.turn(caseId, turnId);
  }

  async recordSupervisorExecution(
    execution: Omit<SupervisorExecutionRecord, "id" | "createdAt">,
  ) {
    await this.ensured();
    return this.turnStore.recordSupervisorExecution(execution);
  }

  async supervisorExecutionsForMonitoring(tenantId: string, caseIds: string[]) {
    await this.ensured();
    return this.turnStore.supervisorExecutionsForMonitoring(tenantId, caseIds);
  }

  async recordFeedback(input: {
    caseId: string;
    turnId: string;
    actorId: string;
    feedback: CaseFeedback;
  }): Promise<CaseFeedback> {
    await this.ensured();
    return this.turnStore.recordFeedback(input);
  }

  async feedback(caseIds: string[]): Promise<FeedbackRecord[]> {
    await this.ensured();
    return this.turnStore.feedback(caseIds);
  }

  async recordTurnTelemetry(
    caseId: string,
    turnId: string,
    telemetry: { traceId?: string; workflowRunId?: string },
  ) {
    await this.ensured();
    return this.turnStore.recordTurnTelemetry(caseId, turnId, telemetry);
  }

  async bindTurnCommand(caseId: string, turnId: string, fingerprint: string) {
    await this.ensured();
    return this.turnStore.bindTurnCommand(caseId, turnId, fingerprint);
  }

  async claimDispatchForStart(
    caseId: string,
    runId?: string,
  ): Promise<DispatchRecord | undefined> {
    await this.ensured();
    return this.turnStore.claimDispatchForStart(caseId, runId);
  }

  async claimDispatchForResume(
    caseId: string,
    runId?: string,
    turnId?: string,
  ): Promise<DispatchRecord | undefined> {
    await this.ensured();
    return this.turnStore.claimDispatchForResume(caseId, runId, turnId);
  }

  async claimOutbox(limit = 10, excludeIds: readonly string[] = []) {
    await this.ensured();
    return this.outbox.claimOutbox(limit, excludeIds);
  }

  async renewOutboxLease(id: string, leaseToken: string) {
    await this.ensured();
    return this.outbox.renewOutboxLease(id, leaseToken);
  }

  async completeOutbox(id: string, receipt: unknown, leaseToken?: string) {
    await this.ensured();
    return this.outbox.completeOutbox(id, receipt, leaseToken);
  }

  async manualOutboxEffectIsCurrent(id: string, leaseToken: string) {
    await this.ensured();
    return this.outbox.manualOutboxEffectIsCurrent(id, leaseToken);
  }

  async supersedeManualOutboxAfterFence(
    id: string,
    receipt: unknown,
    reason: string,
  ) {
    await this.ensured();
    return this.outbox.supersedeManualOutboxAfterFence(id, receipt, reason);
  }

  async manualOutboxNeedsReopen(id: string) {
    await this.ensured();
    return this.outbox.manualOutboxNeedsReopen(id);
  }

  async manualOutboxIsUncertain(id: string) {
    await this.ensured();
    return this.outbox.manualOutboxIsUncertain(id);
  }

  async markManualOutboxReconciliationStarted(id: string) {
    await this.ensured();
    return this.outbox.markManualOutboxReconciliationStarted(id);
  }

  async supersedeOutbox(id: string, leaseToken: string, reason: string) {
    await this.ensured();
    return this.outbox.supersedeOutbox(id, leaseToken, reason);
  }

  async markOutboxStarted(id: string, leaseToken: string) {
    await this.ensured();
    return this.outbox.markOutboxStarted(id, leaseToken);
  }

  async markOutboxUncertain(
    id: string,
    error: unknown,
    leaseToken?: string,
    expectedState?: "claimed" | "started",
  ) {
    await this.ensured();
    return this.outbox.markOutboxUncertain(
      id,
      error,
      leaseToken,
      expectedState,
    );
  }

  async retryOutbox(
    id: string,
    error: unknown,
    terminal = false,
    leaseToken?: string,
    retryAfterMs?: number,
    rateLimited = false,
  ) {
    await this.ensured();
    return this.outbox.retryOutbox(
      id,
      error,
      terminal,
      leaseToken,
      retryAfterMs,
      rateLimited,
    );
  }

  async saveAction(
    caseId: string,
    kind: string,
    fingerprint: string,
    data: unknown,
  ) {
    await this.ensured();
    return this.actions.saveAction(caseId, kind, fingerprint, data);
  }

  async claimStripeWebhookEvent(
    eventId: string,
  ): Promise<
    | { state: "claimed"; leaseToken: string }
    | { state: "completed" }
    | { state: "in-progress" }
  > {
    await this.ensured();
    return this.actions.claimStripeWebhookEvent(eventId);
  }

  async completeStripeWebhookEvent(eventId: string, leaseToken: string) {
    await this.ensured();
    return this.actions.completeStripeWebhookEvent(eventId, leaseToken);
  }

  async failStripeWebhookEvent(eventId: string, leaseToken: string) {
    await this.ensured();
    return this.actions.failStripeWebhookEvent(eventId, leaseToken);
  }

  async recordApprovalDecision(input: {
    caseId: string;
    turnId?: string;
    commandFingerprint: string;
    principalId: string;
    approved: boolean;
    note?: string;
    serviceProblemConfirmed?: true;
    nativeRunId?: string;
    nativeToolCallId?: string;
  }): Promise<{ won: boolean; decisionId?: string }> {
    await this.ensured();
    return this.actions.recordApprovalDecision(input);
  }

  async approvalDecision(caseId: string, turnId?: string) {
    await this.ensured();
    return this.actions.approvalDecision(caseId, turnId);
  }

  async customerFinancialRequests(caseIds: string[]) {
    await this.ensured();
    return this.actions.customerFinancialRequests(caseIds);
  }

  async monitoringDecisions(caseIds: string[], actionKind?: string) {
    await this.ensured();
    return this.actions.monitoringDecisions(caseIds, actionKind);
  }

  async monitoringOperationalFailures(caseIds: string[]) {
    await this.ensured();
    return this.actions.monitoringOperationalFailures(caseIds);
  }

  async monitoringFinancialFailures(caseIds: string[], actionKind?: string) {
    await this.ensured();
    return this.actions.monitoringFinancialFailures(caseIds, actionKind);
  }

  async nativeDecisionsNeedingRecovery(limit = 10) {
    await this.ensured();
    return this.actions.nativeDecisionsNeedingRecovery(limit);
  }

  async getAction(caseId: string, kind: string, fingerprint: string) {
    await this.ensured();
    return this.actions.getAction(caseId, kind, fingerprint);
  }

  async idempotency(key: string) {
    await this.ensured();
    return this.actions.idempotency(key);
  }

  async projectRefundToolExecution(input: {
    caseId: string;
    turnId: string;
    fingerprint: string;
    idempotencyKey: string;
    result: NonNullable<SupportCase["refundResult"]>;
    effect?: unknown;
  }): Promise<NonNullable<SupportCase["refundResult"]>> {
    await this.ensured();
    return this.financial.projectRefundToolExecution(input);
  }

  async projectSubscriptionCreditToolExecution(input: {
    caseId: string;
    turnId: string;
    fingerprint: string;
    idempotencyKey: string;
    result: NonNullable<SupportCase["subscriptionCreditResult"]>;
    effect: unknown;
  }) {
    await this.ensured();
    return this.financial.projectSubscriptionCreditToolExecution(input);
  }

  async prepareStripeRefundAttempt(input: {
    caseId: string;
    binding: ProviderBinding;
    fingerprint: string;
    idempotencyKey: string;
    dispatchId: string;
    leaseToken: string;
    turnId: string;
    command: unknown;
  }) {
    await this.ensured();
    return this.financial.prepareStripeRefundAttempt(input);
  }

  async prepareStripeSubscriptionCreditAttempt(input: {
    caseId: string;
    binding: ProviderBinding;
    customerId: string;
    subscriptionId: string;
    fingerprint: string;
    idempotencyKey: string;
    dispatchId: string;
    leaseToken: string;
    turnId: string;
    command: unknown;
  }) {
    await this.ensured();
    return this.financial.prepareStripeSubscriptionCreditAttempt(input);
  }
  async finalizeStripeSubscriptionCreditNoEffectFailure(input: {
    idempotencyKey: string;
    fingerprint: string;
    dispatch: { dispatchId: string; leaseToken: string; turnId: string };
  }) {
    await this.ensured();
    return this.financial.finalizeStripeSubscriptionCreditNoEffectFailure(
      input,
    );
  }
  async markStripeSubscriptionCreditPrePostNoEffect(input: {
    idempotencyKey: string;
    fingerprint: string;
    dispatch: { dispatchId: string; leaseToken: string; turnId: string };
  }) {
    await this.ensured();
    return this.financial.markStripeSubscriptionCreditPrePostNoEffect(input);
  }

  async updateStripeSubscriptionCreditAttempt(
    idempotencyKey: string,
    update: {
      status: "succeeded" | "unknown" | "failed" | "quarantined";
      creditId?: string;
      providerStatus?: string;
    },
  ) {
    await this.ensured();
    return this.financial.updateStripeSubscriptionCreditAttempt(
      idempotencyKey,
      update,
    );
  }

  async stripeSubscriptionCreditAttempt(idempotencyKey: string) {
    await this.ensured();
    return this.financial.stripeSubscriptionCreditAttempt(idempotencyKey);
  }

  async updateStripeRefundAttempt(
    idempotencyKey: string,
    update: {
      status: "pending" | "succeeded" | "failed" | "unknown" | "quarantined";
      refundId?: string;
      providerStatus?: string;
      nextAttemptAt?: string;
    },
  ) {
    await this.ensured();
    return this.financial.updateStripeRefundAttempt(idempotencyKey, update);
  }

  async persistStripeRefundRequest(
    idempotencyKey: string,
    request: { paymentIntentId: string; providerRefs: unknown[] },
  ) {
    await this.ensured();
    return this.financial.persistStripeRefundRequest(idempotencyKey, request);
  }

  async rescheduleStripeRefundAttempt(input: {
    idempotencyKey: string;
    reconcileLeaseToken: string;
    status: "pending" | "succeeded" | "unknown" | "quarantined";
    refundId?: string;
    providerStatus?: string;
    nextAttemptAt?: string;
  }) {
    await this.ensured();
    return this.financial.rescheduleStripeRefundAttempt(input);
  }

  async finalizeStripeRefundReconciliation(input: {
    idempotencyKey: string;
    status: "succeeded" | "failed" | "pending" | "quarantined";
    refundId: string;
    providerStatus: string;
    effect?: unknown;
    reconcileLeaseToken?: string;
  }) {
    await this.ensured();
    return this.financial.finalizeStripeRefundReconciliation(input);
  }

  async finalizeStripeRefundNoEffectFailure(input: {
    idempotencyKey: string;
    fingerprint: string;
    diagnostic?: {
      stage: "preflight" | "post";
      status?: number;
      ambiguity?: boolean;
      code?: string;
      type?: string;
      requestId?: string;
    };
  }) {
    await this.ensured();
    return this.financial.finalizeStripeRefundNoEffectFailure(input);
  }

  async stripeRefundAttempt(idempotencyKey: string) {
    await this.ensured();
    return this.financial.stripeRefundAttempt(idempotencyKey);
  }

  async stripeRefundAttemptByRefundId(refundId: string) {
    await this.ensured();
    return this.financial.stripeRefundAttemptByRefundId(refundId);
  }

  async claimableStripeRefundAttempts(limit = 10) {
    await this.ensured();
    return this.financial.claimableStripeRefundAttempts(limit);
  }

  async enforceRetention(
    clock: () => Date = () => new Date(),
    policy: RetentionPolicy = retentionPolicyFromEnvironment(),
  ): Promise<RetentionResult> {
    await this.ensured();
    return this.retention.enforceRetention(clock, policy);
  }

  async recordEffect(key: string, fingerprint: string, effect: unknown) {
    await this.ensured();
    return this.cancellation.recordEffect(key, fingerprint, effect);
  }

  async prepareSubscriptionCancellationAttempt(input: {
    caseId: string;
    turnId: string;
    binding: ProviderBinding;
    subscriptionId: string;
    idempotencyKey: string;
    fingerprint: string;
    command: unknown;
  }) {
    await this.ensured();
    return this.cancellation.prepareSubscriptionCancellationAttempt(input);
  }

  async claimSubscriptionCancellationMutation(input: {
    idempotencyKey: string;
    fingerprint: string;
  }) {
    await this.ensured();
    return this.cancellation.claimSubscriptionCancellationMutation(input);
  }

  async finalizeSubscriptionCancellationAttempt(input: {
    idempotencyKey: string;
    fingerprint: string;
    status: "scheduled" | "unknown" | "failed";
    cancelsAt?: string;
    effect?: unknown;
  }) {
    await this.ensured();
    return this.cancellation.finalizeSubscriptionCancellationAttempt(input);
  }

  async claimUnknownSubscriptionCancellationAttempts(limit = 10) {
    await this.ensured();
    return this.cancellation.claimUnknownSubscriptionCancellationAttempts(
      limit,
    );
  }

  async rescheduleSubscriptionCancellationRecovery(input: {
    idempotencyKey: string;
    fingerprint: string;
    recoveryClaim: string;
  }) {
    await this.ensured();
    return this.cancellation.rescheduleSubscriptionCancellationRecovery(input);
  }

  async finalizeUnknownSubscriptionCancellation(input: {
    idempotencyKey: string;
    fingerprint: string;
    status: "scheduled" | "quarantined" | "failed";
    recoveryClaim?: string;
    effect?: {
      subscriptionId: string;
      cancelAtPeriodEnd: true;
      cancelsAt: string;
      idempotencyKey: string;
      replayed: boolean;
    };
  }) {
    await this.ensured();
    return this.cancellation.finalizeUnknownSubscriptionCancellation(input);
  }

  getClient() {
    return this.client;
  }
}

export const caseStore = new CaseStore();
