import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyAmountToMoney, refundFingerprint } from '../../src/mastra/lib/money';
import type { ProviderBinding } from '../../src/mastra/providers/contracts';
import { deterministicJsonModel, deterministicRefundModel } from '../fixtures/deterministic-language-model';
import { temporaryDatabasePath } from '../support/temp-path';

const databaseFiles: string[] = [];
const mastraRuntimes: Array<{ shutdown(): Promise<void> }> = [];

async function loadCharacterizationRuntime(
  draft: {
    recommendRefund: boolean;
    requiresEscalation: boolean;
    refundAmount?: number;
  },
  input = {
    subject: 'I was charged twice',
    body: 'Please refund the duplicate subscription charge.',
  },
) {
  const databasePath = temporaryDatabasePath('phase001-characterization');
  databaseFiles.push(databasePath, `${databasePath}-shm`, `${databasePath}-wal`);
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.LOCAL_DEMO_DATABASE_URL = `file:${databasePath}`;
  process.env.SUPPORT_SOURCE = 'mock';
  process.env.DISABLE_RUNTIME_SCORERS = '1';
  vi.resetModules();
  vi.doMock('@mastra/core/llm', async importOriginal => {
    const actual = await importOriginal<typeof import('@mastra/core/llm')>();
    return {
      ...actual,
      ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {
        async doEmbed({ values }: { values: string[] }) {
          return {
            embeddings: values.map(() => Array.from({ length: 1536 }, () => 0)),
          };
        }
      },
    };
  });

  // index loads the provider registry through a circular workflow graph. Load
  // that graph before its leaves so vi.resetModules cannot expose a partially
  // initialized local-runtime export to a concurrent dynamic import.
  const { mastra } = await import('../../src/mastra/index');
  const { caseStore } = await import('../../src/mastra/lib/case-store');
  const { mockSupportAdapter } = await import('../fixtures/mock-support');
  const { triageAgent } = await import('../../src/mastra/agents/triage-agent');
  const { responseAgent } = await import('../../src/mastra/agents/response-agent');
  const { issueRefundTool } = await import('../../src/mastra/tools/issue-refund');
  const { refundExecutionAgent } = await import('../../src/mastra/agents/refund-execution-agent');

  triageAgent.__updateModel({
    model: deterministicJsonModel({
      intent: 'duplicate_charge',
      urgency: 'normal',
      sentiment: 'negative',
      requiresHumanReview: false,
      confidence: 1,
      rationale: 'Deterministic characterization double.',
    }),
  });
  responseAgent.__updateModel({
    model: deterministicJsonModel({
      draftResponse: 'A deterministic response grounded in the duplicate-charge policy.',
      citedSources: ['duplicate-charge-policy'],
      selectedPolicyExcerpts: [
        {
          source: 'duplicate-charge-policy',
          excerpt:
            "Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.",
        },
      ],
      recommendRefund: draft.recommendRefund,
      refundAmount: draft.refundAmount,
      refundCurrency: draft.recommendRefund ? 'USD' : undefined,
      refundReason: draft.recommendRefund ? 'duplicate charge' : undefined,
      requiresEscalation: draft.requiresEscalation,
      escalationReason: draft.requiresEscalation ? 'Deterministic escalation.' : undefined,
    }),
  });

  const normalized = await mockSupportAdapter.normalizeInbound({
    externalId: `characterization-${crypto.randomUUID()}`,
    from: 'alex@example.com',
    ...input,
  });
  const runId = `characterization-run-${crypto.randomUUID()}`;
  const accepted = await caseStore.acceptInbound(
    {
      id: `case_${crypto.randomUUID()}`,
      status: 'new',
      ...normalized,
      metadata: { ...normalized.metadata, ownerId: 'customer-alex' },
    },
    `event_${crypto.randomUUID()}`,
    runId,
  );
  const supportCase = await caseStore.get(accepted.caseId);
  if (!supportCase) throw new Error('Expected accepted support case.');
  const [turn] = await caseStore.turns(supportCase.id);
  if (!turn) throw new Error('Expected an immutable inbound turn.');
  await caseStore.update(supportCase.id, {
    workflowRunId: runId,
    metadata: {
      ...supportCase.metadata,
      ownerId: 'customer-alex',
      activeTurnId: turn.id,
    },
  });
  const executionModel = async () => {
    const action = await caseStore.getClient().execute({
      sql: "SELECT data FROM support_actions WHERE kind = 'refund-command' ORDER BY created_at DESC LIMIT 1",
    });
    const command = JSON.parse(String(action.rows[0]?.data ?? '{}')) as {
      approvalCaseId?: string;
      orderId?: string;
      amount?: { minor?: number; currency?: string };
      reason?: string;
      idempotencyKey?: string;
      fingerprint?: string;
    };
    return deterministicRefundModel({
      caseId: command.approvalCaseId,
      orderId: command.orderId,
      amount: (command.amount?.minor ?? 0) / 100,
      currency: command.amount?.currency,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    }) as never;
  };
  refundExecutionAgent.__updateModel({ model: executionModel });
  mastra.getAgent('refundExecutionAgent').__updateModel({
    model: executionModel,
  });
  mastraRuntimes.push(mastra);

  return {
    mastra,
    caseStore,
    supportCase,
    issueRefundTool,
    responseAgent,
  };
}

async function startQueuedWorkflow(runtime: Awaited<ReturnType<typeof loadCharacterizationRuntime>>) {
  const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
  expect(await recoverLocalWorkflows(runtime.mastra, 10, runtime.caseStore)).toBe(1);
  const supportCase = await runtime.caseStore.get(runtime.supportCase.id);
  expect(supportCase).toMatchObject({ status: 'waiting_approval' });
  return supportCase!;
}

async function decideNativeApproval(
  runtime: Awaited<ReturnType<typeof loadCharacterizationRuntime>>,
  approved: boolean,
  expectedRecovery = 1,
) {
  const supportCase = await runtime.caseStore.get(runtime.supportCase.id);
  if (!supportCase) throw new Error('Expected a suspended support case.');
  const native = (supportCase.metadata as Record<string, unknown>).nativeApproval as {
    runId?: string;
    toolCallId?: string;
    turnId?: string;
    fingerprint?: string;
  };
  if (!native?.runId || !native.toolCallId || !native.turnId || !native.fingerprint)
    throw new Error('Expected a native approval binding.');
  const decision = await runtime.caseStore.recordApprovalDecision({
    caseId: runtime.supportCase.id,
    turnId: native.turnId,
    commandFingerprint: native.fingerprint,
    principalId: 'approver-demo',
    approved,
    nativeRunId: native.runId,
    nativeToolCallId: native.toolCallId,
  });
  expect(decision.won).toBe(true);
  const { recoverApprovedNativeDecisions } = await import('../../src/mastra/runtime/local-runtime');
  expect(
    await recoverApprovedNativeDecisions(runtime.mastra, runtime.caseStore, {
      disableScorers: true,
    }),
  ).toBe(expectedRecovery);
}

afterEach(async () => {
  await Promise.all(mastraRuntimes.splice(0).map(runtime => runtime.shutdown()));
  vi.restoreAllMocks();
  vi.doUnmock('@mastra/core/llm');
  await Promise.all(databaseFiles.splice(0).map(file => rm(file, { force: true })));
});

describe('resolve support case WIP characterization', () => {
  it('recovers a pre-start dispatch through the installed Mastra run API', async () => {
    const { mastra, caseStore, supportCase } = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const caseId = `recovery_${crypto.randomUUID()}`;
    const runId = `run_${crypto.randomUUID()}`;
    const externalId = `recovery-event-${crypto.randomUUID()}`;
    const bindings = supportCase.metadata.providerBindings as {
      support: ProviderBinding;
      commerce: ProviderBinding;
      transactions: ProviderBinding;
      knowledge: ProviderBinding;
    };
    const binding = {
      ...bindings.support,
      externalConversationId: externalId,
    };
    await caseStore.acceptInbound(
      {
        ...supportCase,
        id: caseId,
        externalId,
        messages: supportCase.messages.map(message => ({
          ...message,
          id: `message_${crypto.randomUUID()}`,
        })),
        metadata: {
          ...supportCase.metadata,
          ownerId: 'customer-alex',
          providerBinding: binding,
          providerBindings: { ...bindings, support: binding },
        },
      },
      `event_${crypto.randomUUID()}`,
      runId,
    );
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    await recoverLocalWorkflows(mastra, 10, caseStore);
    expect(await mastra.getWorkflow('resolveSupportCaseWorkflow').getWorkflowRunById(runId)).toMatchObject({
      status: 'suspended',
    });
    const dispatch = await caseStore.getClient().execute({
      sql: 'SELECT state FROM support_dispatch WHERE case_id = ?',
      args: [caseId],
    });
    expect(dispatch.rows[0]).toMatchObject({ state: 'suspended' });
  });

  it('suspends a refund recommendation, then resolves after the existing workflow approval checkpoint', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { caseStore, supportCase } = runtime;
    const suspended = await startQueuedWorkflow(runtime);
    expect((await caseStore.get(supportCase.id))?.policyMatches?.[0]?.source).toBe('duplicate-charge-policy');
    expect((suspended.metadata as Record<string, unknown>).nativeApproval).toBeDefined();

    await decideNativeApproval(runtime, true);
    expect(await caseStore.get(supportCase.id)).toMatchObject({
      status: 'resolved',
      approval: { approved: true, approverId: 'approver-demo' },
      refundResult: { amount: 49, status: 'executed' },
    });
  });

  it('escalates when the existing approval checkpoint is rejected', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { caseStore, supportCase } = runtime;
    await startQueuedWorkflow(runtime);
    await decideNativeApproval(runtime, false);
    expect(await caseStore.get(supportCase.id)).toMatchObject({
      status: 'escalated',
      approval: { approved: false, approverId: 'approver-demo' },
    });
  });

  it('suspends a distinct second refund command after the first command is rejected', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { caseStore, supportCase } = runtime;
    const firstSuspended = await startQueuedWorkflow(runtime);
    const firstNative = (firstSuspended.metadata as Record<string, unknown>).nativeApproval as {
      turnId: string;
      fingerprint: string;
    };
    await decideNativeApproval(runtime, false);
    expect((await caseStore.get(supportCase.id))?.status).toBe('escalated');
    const followUp = await caseStore.appendFollowUp({
      caseId: supportCase.id,
      eventId: `second-refund-command-${crypto.randomUUID()}`,
      runId: `second-refund-run-${crypto.randomUUID()}`,
      message: {
        id: `second-refund-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: 'Please review a distinct second refund request.',
        createdAt: new Date().toISOString(),
      },
    });
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    const secondSuspended = await caseStore.get(supportCase.id);
    const secondNative = (secondSuspended!.metadata as Record<string, unknown>).nativeApproval as {
      turnId: string;
      fingerprint: string;
    };
    expect(secondSuspended?.status).toBe('waiting_approval');
    expect(secondNative.turnId).toBe(followUp.turnId);
    expect(secondNative.fingerprint).not.toBe(firstNative.fingerprint);
    expect((await caseStore.approvalDecision(supportCase.id, firstNative.turnId))?.approved).toBe(false);
  });

  it('runs a queued follow-up after completion with its own model input, output, and outbox', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: false,
    });
    const { caseStore, supportCase, responseAgent } = runtime;
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    const first = await caseStore.get(supportCase.id);
    expect(first?.status).toBe('resolved');
    responseAgent.__updateModel({
      model: deterministicJsonModel({
        draftResponse: 'A distinct response for the queued second request.',
        citedSources: ['duplicate-charge-policy'],
        recommendRefund: false,
        requiresEscalation: true,
        escalationReason: 'Second-turn escalation.',
      }),
    });
    const followUp = await caseStore.appendFollowUp({
      caseId: supportCase.id,
      eventId: `queued-after-completion-${crypto.randomUUID()}`,
      runId: `queued-after-completion-run-${crypto.randomUUID()}`,
      message: {
        id: `queued-after-completion-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: 'A separate second request must be escalated.',
        createdAt: new Date().toISOString(),
      },
    });
    expect(followUp.appended).toBe(true);
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    const second = await caseStore.get(supportCase.id);
    expect(second).toMatchObject({
      status: 'escalated',
      finalResponse:
        'Thanks for your patience. A support specialist needs to review the available information and will follow up shortly.',
      escalationReason: 'Second-turn escalation.',
    });
    const turns = await caseStore.turns(supportCase.id);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      outcome: { status: 'resolved' },
      message: { body: 'Please refund the duplicate subscription charge.' },
    });
    expect(turns[1]).toMatchObject({
      message: { body: 'A separate second request must be escalated.' },
      outcome: { status: 'escalated' },
    });
    const outbox = await caseStore.getClient().execute({
      sql: 'SELECT id, body FROM support_outbox WHERE case_id = ? ORDER BY created_at, id',
      args: [supportCase.id],
    });
    expect(outbox.rows).toHaveLength(2);
    expect(outbox.rows.map(row => String(row.id))).toEqual([
      `outbox_${supportCase.id}_${turns[0]!.id}_final`,
      `outbox_${supportCase.id}_${turns[1]!.id}_final`,
    ]);
  });

  it('does not include a queued later turn in the current policy search', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: false,
    });
    const { knowledgePublicationStore } = await import('../../src/mastra/lib/knowledge-publications');
    const search = vi.spyOn(knowledgePublicationStore, 'search');
    const futureMessage = 'future-only policy signal must not affect this search';
    const queued = await runtime.caseStore.appendFollowUp({
      caseId: runtime.supportCase.id,
      eventId: `future-turn-${crypto.randomUUID()}`,
      runId: `future-turn-run-${crypto.randomUUID()}`,
      message: {
        id: `future-turn-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: futureMessage,
        createdAt: new Date().toISOString(),
      },
    });
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');

    expect(queued.appended).toBe(true);
    expect(await recoverLocalWorkflows(runtime.mastra, 1, runtime.caseStore)).toBe(1);
    const queryTexts = search.mock.calls.map(([, queryText]) => queryText);
    expect(queryTexts.some(queryText => queryText.includes('Please refund the duplicate subscription charge.'))).toBe(
      true,
    );
    expect(queryTexts.some(queryText => queryText.includes(futureMessage))).toBe(false);
  });

  it('freshly retrieves policy evidence for a contextual follow-up and a later topic switch', async () => {
    const runtime = await loadCharacterizationRuntime(
      { recommendRefund: false, requiresEscalation: false },
      {
        subject: 'Dúvida sobre assinatura',
        body: 'Quero entender as regras para cancelar a assinatura.',
      },
    );
    const { triageAgent } = await import('../../src/mastra/agents/triage-agent');
    const { caseStore, responseAgent, supportCase } = runtime;
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    const subscriptionExcerpt =
      'Customers can cancel a subscription at any time. Cancellation takes effect at the end of the current billing period unless the customer explicitly asks for an immediate cancellation with a prorated refund.';

    triageAgent.__updateModel({
      model: deterministicJsonModel({
        intent: 'cancellation',
        urgency: 'low',
        sentiment: 'neutral',
        requiresHumanReview: false,
        confidence: 1,
        rationale: 'Informational cancellation-policy question.',
      }),
    });
    responseAgent.__updateModel({
      model: deterministicJsonModel({
        draftResponse: 'The subscription cancellation policy explains the timing.',
        citedSources: ['subscription-cancellation-policy'],
        selectedPolicyExcerpts: [
          {
            source: 'subscription-cancellation-policy',
            excerpt: subscriptionExcerpt,
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }),
    });
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    expect((await caseStore.get(supportCase.id))?.policyMatches).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'subscription-cancellation-policy' })]),
    );

    const followUp = await caseStore.appendFollowUp({
      caseId: supportCase.id,
      eventId: `contextual-follow-up-${crypto.randomUUID()}`,
      runId: `contextual-follow-up-run-${crypto.randomUUID()}`,
      message: {
        id: `contextual-follow-up-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: 'Meu período pago continua ativo até o fim do ciclo, certo? Só quero confirmar a regra.',
        createdAt: new Date().toISOString(),
      },
    });
    triageAgent.__updateModel({
      model: deterministicJsonModel({
        intent: 'other',
        urgency: 'low',
        sentiment: 'neutral',
        requiresHumanReview: false,
        confidence: 1,
        rationale: 'Informational follow-up.',
      }),
    });
    expect(followUp.appended).toBe(true);
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    expect(await caseStore.get(supportCase.id)).toMatchObject({
      status: 'resolved',
      draft: { citedSources: ['subscription-cancellation-policy'] },
      policyMatches: expect.arrayContaining([expect.objectContaining({ source: 'subscription-cancellation-policy' })]),
    });

    const topicSwitch = await caseStore.appendFollowUp({
      caseId: supportCase.id,
      eventId: `topic-switch-${crypto.randomUUID()}`,
      runId: `topic-switch-run-${crypto.randomUUID()}`,
      message: {
        id: `topic-switch-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: 'Outro item chegou danificado. O que diz a regra?',
        createdAt: new Date().toISOString(),
      },
    });
    const damagedExcerpt =
      "If a customer reports an item arrived damaged or defective, offer either a **full refund** or a **free replacement** - let the customer choose if they haven't already stated a preference.";
    triageAgent.__updateModel({
      model: deterministicJsonModel({
        intent: 'damaged_item',
        urgency: 'low',
        sentiment: 'neutral',
        requiresHumanReview: false,
        confidence: 1,
        rationale: 'Informational damaged-item policy question.',
      }),
    });
    responseAgent.__updateModel({
      model: deterministicJsonModel({
        draftResponse: 'The damaged-item policy explains the available options.',
        citedSources: ['damaged-item-policy'],
        selectedPolicyExcerpts: [{ source: 'damaged-item-policy', excerpt: damagedExcerpt }],
        recommendRefund: false,
        requiresEscalation: false,
      }),
    });
    expect(topicSwitch.appended).toBe(true);
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    expect(await caseStore.get(supportCase.id)).toMatchObject({
      status: 'resolved',
      draft: { citedSources: ['damaged-item-policy'] },
      policyMatches: expect.arrayContaining([expect.objectContaining({ source: 'damaged-item-policy' })]),
    });
  });

  it('runs a queued follow-up after escalation without retaining the prior output', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: true,
    });
    const { caseStore, supportCase, responseAgent } = runtime;
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    expect(await recoverLocalWorkflows(runtime.mastra, 1, caseStore)).toBe(1);
    expect((await caseStore.get(supportCase.id))?.status).toBe('escalated');
    responseAgent.__updateModel({
      model: deterministicJsonModel({
        draftResponse: 'A clean resolved answer for the second request.',
        citedSources: ['duplicate-charge-policy'],
        selectedPolicyExcerpts: [
          {
            source: 'duplicate-charge-policy',
            excerpt:
              'Duplicate-charge refunds do not require the customer to return anything, since no extra product/service was fulfilled.',
          },
        ],
        recommendRefund: false,
        requiresEscalation: false,
      }),
    });
    const followUp = await caseStore.appendFollowUp({
      caseId: supportCase.id,
      eventId: `queued-after-escalation-${crypto.randomUUID()}`,
      runId: `queued-after-escalation-run-${crypto.randomUUID()}`,
      message: {
        id: `queued-after-escalation-message-${crypto.randomUUID()}`,
        author: 'customer',
        body: 'A second request can now be resolved.',
        createdAt: new Date().toISOString(),
      },
    });
    await recoverLocalWorkflows(runtime.mastra, 1, caseStore);
    const second = await caseStore.get(supportCase.id);
    expect(second).toMatchObject({
      status: 'resolved',
      finalResponse:
        'The published Duplicate Charge Policy says: “Duplicate-charge refunds do not require the customer to return anything, since no extra product/service was fulfilled.” Your order ORD-1001 is currently recorded as fulfilled. Your Pro Plan - Monthly subscription is currently recorded as active.',
    });
    expect(second?.escalationReason).toBeUndefined();
    const turns = await caseStore.turns(supportCase.id);
    expect(turns[0]).toMatchObject({ outcome: { status: 'escalated' } });
    expect(turns[1]).toMatchObject({
      id: followUp.turnId,
      outcome: { status: 'resolved' },
    });
  });

  it('rejects a direct refund-tool bypass before approval and refuses a tampered persisted command after approval', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { caseStore, issueRefundTool, supportCase } = runtime;
    const suspended = await startQueuedWorkflow(runtime);
    expect(suspended).toBeDefined();
    if (!suspended) throw new Error('Expected workflow to suspend the case.');
    const command = (suspended.metadata as Record<string, unknown>).refundCommand as {
      orderId: string;
      amount: number;
      currency: string;
      reason: string;
      idempotencyKey: string;
      fingerprint: string;
    };
    await expect(issueRefundTool.execute({ caseId: supportCase.id, ...command })).rejects.toThrow(
      'persisted approved local decision',
    );
    await caseStore.update(supportCase.id, {
      metadata: {
        ...suspended.metadata,
        refundCommand: {
          ...command,
          amount: command.amount - 1,
          fingerprint: refundFingerprint({
            binding: (
              suspended.metadata.providerBindings as {
                transactions: ProviderBinding;
              }
            ).transactions,
            approvalCaseId: supportCase.id,
            orderId: command.orderId,
            amount: legacyAmountToMoney(command.amount - 1, command.currency),
            reason: command.reason,
            idempotencyKey: command.idempotencyKey,
          }),
        },
      },
    });
    await decideNativeApproval(runtime, true, 0);
    expect((await caseStore.get(supportCase.id))?.refundResult).toBeUndefined();
  });

  it('queues a detached workflow retry when its refund quote exceeds the remaining balance', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { mastra, caseStore } = runtime;
    await startQueuedWorkflow(runtime);
    await decideNativeApproval(runtime, true);

    const payload = {
      externalId: `exhausted-balance-${crypto.randomUUID()}`,
      from: 'alex@example.com',
      subject: 'I was charged twice again',
      body: 'Please refund the duplicate subscription charge.',
    };
    const ingested = await (
      await mastra.getWorkflow('ingestSupportCaseWorkflow').createRun()
    ).start({
      inputData: {
        payload,
        ingress: {
          id: 'customer-alex',
          email: 'alex@example.com',
          tenantId: 'local-demo',
          roles: ['customer'],
        },
      },
    });

    expect(ingested.status).toBe('success');
    await vi.waitFor(async () =>
      expect(
        (
          await caseStore.getClient().execute({
            sql: 'SELECT state FROM support_dispatch WHERE case_id = ?',
            args: [ingested.result.caseId],
          })
        ).rows[0],
      ).toMatchObject({ state: 'pending' }),
    );
  });

  it('escalates a deterministic policy decision that does not require a refund', async () => {
    const { mastra, caseStore, supportCase } = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: true,
    });
    const run = await mastra
      .getWorkflow('resolveSupportCaseWorkflow')
      .createRun({ runId: supportCase.workflowRunId!, disableScorers: true });

    const [turn] = await caseStore.turns(supportCase.id);
    const result = await run.start({
      inputData: { caseId: supportCase.id, turnId: turn!.id },
    });

    expect(result.status).toBe('success');
    expect(await caseStore.get(supportCase.id)).toMatchObject({
      status: 'escalated',
      escalationReason: 'Deterministic escalation.',
    });
  });

  it('makes triage review override a refund draft and preserves its reason', async () => {
    const runtime = await loadCharacterizationRuntime({
      recommendRefund: true,
      requiresEscalation: false,
      refundAmount: 49,
    });
    const { triageAgent } = await import('../../src/mastra/agents/triage-agent');
    triageAgent.__updateModel({
      model: deterministicJsonModel({
        intent: 'duplicate_charge',
        urgency: 'high',
        sentiment: 'angry',
        requiresHumanReview: true,
        confidence: 0.2,
        rationale: 'The message raises a chargeback concern.',
      }),
    });
    const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
    expect(await recoverLocalWorkflows(runtime.mastra, 1, runtime.caseStore)).toBe(1);
    expect(await runtime.caseStore.get(runtime.supportCase.id)).toMatchObject({
      status: 'escalated',
      escalationReason: 'Triage requires human review: The message raises a chargeback concern.',
    });
    expect((await runtime.caseStore.get(runtime.supportCase.id))?.refundResult).toBeUndefined();
  });

  it('reports a failed workflow when the deterministic triage transport returns an invalid result', async () => {
    const { mastra, caseStore, supportCase } = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: false,
    });
    const { triageAgent } = await import('../../src/mastra/agents/triage-agent');
    triageAgent.__updateModel({ model: deterministicJsonModel({}) });
    const run = await mastra
      .getWorkflow('resolveSupportCaseWorkflow')
      .createRun({ runId: supportCase.workflowRunId!, disableScorers: true });

    const [turn] = await caseStore.turns(supportCase.id);
    const result = await run.start({
      inputData: { caseId: supportCase.id, turnId: turn!.id },
    });

    expect(result.status).toBe('failed');
  });

  it('persists an inbound case once and returns the same case for a duplicate event', async () => {
    const { mastra, caseStore } = await loadCharacterizationRuntime({
      recommendRefund: false,
      requiresEscalation: false,
    });
    const workflow = mastra.getWorkflow('ingestSupportCaseWorkflow');
    const payload = {
      externalId: `ingest-${crypto.randomUUID()}`,
      from: 'alex@example.com',
      subject: 'I was charged twice',
      body: 'Please refund the duplicate subscription charge.',
    };

    const [first, second] = await Promise.all([
      (await workflow.createRun()).start({
        inputData: {
          payload,
          ingress: {
            id: 'customer-alex',
            email: 'alex@example.com',
            tenantId: 'local-demo',
            roles: ['customer'],
          },
        },
      }),
      (await workflow.createRun()).start({
        inputData: {
          payload,
          ingress: {
            id: 'customer-alex',
            email: 'alex@example.com',
            tenantId: 'local-demo',
            roles: ['customer'],
          },
        },
      }),
    ]);

    expect(first.status).toBe('success');
    expect(second.status).toBe('success');
    expect(first.result.caseId).toBe(second.result.caseId);
    expect((await caseStore.list()).filter(supportCase => supportCase.externalId === payload.externalId)).toHaveLength(
      1,
    );
    await vi.waitFor(async () => {
      expect((await caseStore.get(first.result.caseId))?.status).toBe('resolved');
      expect(
        (
          await caseStore.getClient().execute({
            sql: 'SELECT state FROM support_dispatch WHERE case_id = ?',
            args: [first.result.caseId],
          })
        ).rows[0],
      ).toMatchObject({ state: 'completed' });
    });
  });
});
