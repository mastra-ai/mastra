import type { LanguageModelV2 } from '@ai-sdk/provider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { temporaryDatabasePath } from '../support/temp-path';

const files: string[] = [];

function deterministicRefundModel(input: Record<string, unknown>): LanguageModelV2 {
  let called = false;
  return {
    specificationVersion: 'v2',
    provider: 'phase003-test',
    modelId: 'deterministic-refund',
    supportedUrls: {},
    async doGenerate(options) {
      if (!called && options.tools?.some(tool => tool.type === 'function' && tool.name === 'issue_refund')) {
        called = true;
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'native-tool-call',
              toolName: 'issue_refund',
              input: JSON.stringify(input),
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: 'done' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'done' });
            controller.enqueue({
              type: 'text-delta',
              id: 'done',
              delta: 'done',
            });
            controller.enqueue({ type: 'text-end', id: 'done' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1 },
            });
            controller.close();
          },
        }),
      };
    },
  };
}

afterEach(async () => {
  vi.resetModules();
  await Promise.all(files.splice(0).map(file => rm(file, { force: true })));
});

describe('native issue_refund approval', () => {
  it('suspends the real Agent before one authenticated approval creates one effect', async () => {
    const path = temporaryDatabasePath('phase003-native');
    files.push(path, `${path}-shm`, `${path}-wal`);
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    process.env.SUPPORT_SOURCE = 'mock';
    const { mastra } = await import('../../src/mastra/index');
    const { caseStore } = await import('../../src/mastra/lib/case-store');
    const { money, refundFingerprint } = await import('../../src/mastra/lib/money');
    const { defaultLocalBinding, localRuntime } = await import('../../src/mastra/runtime/local-runtime');
    const binding = defaultLocalBinding('conversation-native');
    const base = {
      approvalCaseId: 'native-case',
      binding,
      orderId: 'ORD-1001',
      amount: money('USD', 2000),
      reason: 'duplicate',
      idempotencyKey: 'native-case',
    };
    const fingerprint = refundFingerprint(base);
    await localRuntime.seed(binding);
    await caseStore.create({
      id: 'native-case',
      externalId: 'native-event',
      source: 'mock-email',
      customer: { email: 'alex@example.com' },
      subject: 'Duplicate',
      messages: [
        {
          id: 'native-message',
          author: 'customer',
          body: 'refund',
          createdAt: new Date().toISOString(),
        },
      ],
      status: 'waiting_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ownerId: 'customer-alex',
        providerBinding: binding,
        refundCommand: {
          approvalCaseId: 'native-case',
          orderId: 'ORD-1001',
          amount: 20,
          currency: 'USD',
          reason: 'duplicate',
          idempotencyKey: 'native-case',
          fingerprint,
        },
        nativeApproval: {
          runId: 'native-run-pending',
          toolCallId: 'native-call-pending',
          fingerprint,
          turnId: 'legacy:native-case',
        },
      },
    });
    await caseStore.saveAction('native-case', 'refund-command', fingerprint, {
      ...base,
      fingerprint,
    });
    const { publishKnowledge } = await import('../../src/mastra/lib/publish-knowledge');
    const { knowledgePublicationStore } = await import('../../src/mastra/lib/knowledge-publications');
    await publishKnowledge(binding);
    const [citation] = await knowledgePublicationStore.search(binding, 'duplicate charge', 1);
    await caseStore.saveAction('native-case', 'refund-policy-evidence', fingerprint, {
      turnId: 'legacy:native-case',
      binding: {
        tenantId: binding.tenantId,
        providerKind: binding.providerKind,
        providerAccountId: binding.providerAccountId,
      },
      citations: [citation],
    });
    const agent = mastra.getAgent('refundExecutionAgent');
    const model = deterministicRefundModel({
      caseId: 'native-case',
      orderId: 'ORD-1001',
      amount: 20,
      currency: 'USD',
      reason: 'duplicate',
      idempotencyKey: 'native-case',
      fingerprint,
    });
    const suspended = await agent.generate(
      `Call issue_refund once with exactly this immutable command JSON: ${JSON.stringify({ caseId: 'native-case', orderId: 'ORD-1001', amount: 20, currency: 'USD', reason: 'duplicate', idempotencyKey: 'native-case', fingerprint })}`,
      {
        model: model as never,
      },
    );
    expect(suspended.finishReason).toBe('suspended');
    const call = suspended.suspendPayload!;
    await caseStore.update('native-case', {
      approval: { approved: true, approverId: 'approver-demo' },
      metadata: {
        ...(await caseStore.get('native-case'))!.metadata,
        nativeApproval: {
          runId: suspended.runId,
          toolCallId: call.toolCallId,
          fingerprint,
          turnId: 'legacy:native-case',
        },
      },
    });
    await caseStore.recordApprovalDecision({
      caseId: 'native-case',
      commandFingerprint: fingerprint,
      principalId: 'approver-demo',
      approved: true,
      nativeRunId: suspended.runId,
      nativeToolCallId: call.toolCallId,
      turnId: 'legacy:native-case',
    });
    await caseStore.update('native-case', {
      workflowRunId: 'native-workflow-run',
    });
    const dispatch = await caseStore.claimDispatchForResume('native-case', 'native-workflow-run', 'legacy:native-case');
    const { withDispatchLeaseScope } = await import('../../src/mastra/lib/dispatch-lease-scope');
    const { resumeApprovedNativeTool } = await import('../../src/mastra/providers/native-execution');
    const approved = await withDispatchLeaseScope(
      {
        dispatchId: dispatch!.id,
        caseId: 'native-case',
        turnId: 'legacy:native-case',
        leaseToken: dispatch!.leaseToken!,
      },
      () =>
        resumeApprovedNativeTool({
          mastra,
          approved: true,
          scope: {
            caseId: 'native-case',
            turnId: 'legacy:native-case',
            nativeRunId: suspended.runId!,
            nativeToolCallId: call.toolCallId!,
            commandFingerprint: fingerprint,
            dispatchId: dispatch!.id,
            leaseToken: dispatch!.leaseToken!,
          },
          model: model as never,
        }),
    );
    expect(approved.finishReason).toBe('stop');
    expect((await caseStore.get('native-case'))?.refundResult).toMatchObject({
      status: 'executed',
      amount: 20,
    });
    await expect(
      agent.approveToolCallGenerate({
        runId: suspended.runId,
        toolCallId: call.toolCallId,
        model: model as never,
      }),
    ).rejects.toThrow();
    await mastra.shutdown();
  });

  it('suspends the real Agent and a recorded rejection creates no effect', async () => {
    const path = temporaryDatabasePath('phase003-native');
    files.push(path, `${path}-shm`, `${path}-wal`);
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    process.env.SUPPORT_SOURCE = 'mock';
    const { mastra } = await import('../../src/mastra/index');
    const { caseStore } = await import('../../src/mastra/lib/case-store');
    const { money, refundFingerprint } = await import('../../src/mastra/lib/money');
    const { defaultLocalBinding, localRuntime } = await import('../../src/mastra/runtime/local-runtime');
    const caseId = 'native-decline';
    const binding = defaultLocalBinding('conversation-native-decline');
    const base = {
      approvalCaseId: caseId,
      binding,
      orderId: 'ORD-1001',
      amount: money('USD', 2000),
      reason: 'duplicate',
      idempotencyKey: caseId,
    };
    const fingerprint = refundFingerprint(base);
    await localRuntime.seed(binding);
    await caseStore.create({
      id: caseId,
      externalId: 'native-decline-event',
      source: 'mock-email',
      customer: { email: 'alex@example.com' },
      subject: 'Duplicate',
      messages: [
        {
          id: 'native-decline-message',
          author: 'customer',
          body: 'refund',
          createdAt: new Date().toISOString(),
        },
      ],
      status: 'waiting_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ownerId: 'customer-alex',
        providerBinding: binding,
        refundCommand: {
          approvalCaseId: caseId,
          orderId: 'ORD-1001',
          amount: 20,
          currency: 'USD',
          reason: 'duplicate',
          idempotencyKey: caseId,
          fingerprint,
        },
        nativeApproval: {
          runId: 'native-run-pending',
          toolCallId: 'native-call-pending',
          fingerprint,
          turnId: `legacy:${caseId}`,
        },
      },
    });
    await caseStore.saveAction(caseId, 'refund-command', fingerprint, {
      ...base,
      fingerprint,
    });
    const model = deterministicRefundModel({
      caseId,
      orderId: 'ORD-1001',
      amount: 20,
      currency: 'USD',
      reason: 'duplicate',
      idempotencyKey: caseId,
      fingerprint,
    });
    const agent = mastra.getAgent('refundExecutionAgent');
    const suspended = await agent.generate(
      `Call issue_refund once with exactly this immutable command JSON: ${JSON.stringify({ caseId, orderId: 'ORD-1001', amount: 20, currency: 'USD', reason: 'duplicate', idempotencyKey: caseId, fingerprint })}`,
      { model: model as never },
    );
    expect(suspended.finishReason).toBe('suspended');
    const call = suspended.suspendPayload!;
    await caseStore.update(caseId, {
      metadata: {
        ...(await caseStore.get(caseId))!.metadata,
        nativeApproval: {
          runId: suspended.runId,
          toolCallId: call.toolCallId,
          fingerprint,
          turnId: `legacy:${caseId}`,
        },
      },
    });
    await caseStore.recordApprovalDecision({
      caseId,
      commandFingerprint: fingerprint,
      principalId: 'approver-demo',
      approved: false,
      nativeRunId: suspended.runId,
      nativeToolCallId: call.toolCallId,
      turnId: `legacy:${caseId}`,
    });
    const declined = await agent.declineToolCallGenerate({
      runId: suspended.runId,
      toolCallId: call.toolCallId,
      model: model as never,
      reason: 'Rejected in authenticated approval route.',
    });
    expect(declined.finishReason).toBe('stop');
    expect((await caseStore.get(caseId))?.refundResult).toBeUndefined();
    expect(await localRuntime.refunds(binding, 'ORD-1001')).toEqual([]);
    await mastra.shutdown();
  });
});
