import { afterEach, describe, expect, it, vi } from "vitest";
import { startLocalRuntimeWorkers } from "../../src/mastra/runtime/local-runtime";
import { startAfterStorageReady } from "../../src/mastra/runtime/storage-lifecycle";

describe("local runtime lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores interval ticks during an active sweep and drains it on stop", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    let entered!: () => void;
    const active = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const sweep = vi.fn(async () => {
      entered();
      await active;
    });
    const stop = startLocalRuntimeWorkers({} as never, undefined, {
      initialDelayMs: 0,
      intervalMs: 2,
      runSweep: sweep,
    });
    await vi.advanceTimersByTimeAsync(0);
    await started;
    await vi.advanceTimersByTimeAsync(10);
    expect(sweep).toHaveBeenCalledTimes(1);

    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    expect(stopped).toBe(false);
    expect(sweep).toHaveBeenCalledTimes(1);
    release();
    await stopping;
    await vi.advanceTimersByTimeAsync(10);
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  it("starts a later interval sweep after the active sweep completes", async () => {
    vi.useFakeTimers();
    const sweep = vi.fn(async () => undefined);
    const stop = startLocalRuntimeWorkers({} as never, undefined, {
      initialDelayMs: 0,
      intervalMs: 2,
      runSweep: sweep,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(sweep).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(sweep).toHaveBeenCalledTimes(2);
    await stop();
  });

  it("observes storage startup rejection on the same lifecycle chain", async () => {
    const failure = new Error("synthetic storage startup failure");
    const onFailure = vi.fn();
    const lifecycle = startAfterStorageReady(
      Promise.reject(failure),
      () => undefined,
      onFailure,
    );
    await expect(lifecycle).rejects.toBe(failure);
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith(failure));
  });

  it("keeps recovery active but leaves local fixtures and the Studio case absent in explicit external mode", async () => {
    const previousAppMode = process.env.APP_MODE;
    const previousSupportSource = process.env.SUPPORT_SOURCE;
    const previousCommerceSource = process.env.COMMERCE_SOURCE;
    const seed = vi.fn(async () => undefined);
    const ensureStudioCase = vi.fn(async () => undefined);
    const recoverApprovals = vi.fn(async () => undefined);
    const recoverWorkflows = vi.fn(async () => undefined);
    const reconcileRefunds = vi.fn(async () => undefined);
    const reconcileCancellations = vi.fn(async () => undefined);
    const outbox = vi.fn(async () => undefined);
    const recoverCloseIntents = vi.fn(async () => undefined);
    const retention = vi.fn(async () => ({}));
    const requireLocalDatabase = vi.fn();
    process.env.APP_MODE = "staging";
    vi.useFakeTimers();
    vi.resetModules();
    vi.doMock("../../src/mastra/lib/case-store", () => ({
      caseStore: { enforceRetention: retention },
    }));
    vi.doMock("../../src/mastra/lib/database-url", () => ({
      requireLocalDatabaseUrl: requireLocalDatabase,
    }));
    vi.doMock("../../src/mastra/runtime/local-provider", () => ({
      defaultLocalBinding: () => ({ tenantId: "local-demo" }),
      localRuntime: { seed },
    }));
    vi.doMock("../../src/mastra/runtime/native-approval-recovery", () => ({
      recoverApprovedNativeDecisions: recoverApprovals,
    }));
    vi.doMock("../../src/mastra/runtime/workflow-recovery", () => ({
      recoverLocalWorkflows: recoverWorkflows,
    }));
    vi.doMock("../../src/mastra/runtime/outbox", () => ({
      deliverOutbox: outbox,
    }));
    vi.doMock("../../src/mastra/runtime/studio-seed", () => ({
      ensureStudioSupervisorDemoCase: ensureStudioCase,
    }));
    vi.doMock("../../src/mastra/providers/stripe/reconciliation", () => ({
      reconcileStripeRefundAttempts: reconcileRefunds,
    }));
    vi.doMock(
      "../../src/mastra/providers/stripe/cancellation-reconciliation",
      () => ({
        reconcileUnknownSubscriptionCancellations: reconcileCancellations,
      }),
    );
    vi.doMock("../../src/mastra/runtime/intercom-close-recovery", () => ({
      recoverIntercomCloseIntents: recoverCloseIntents,
    }));
    vi.doMock("../../src/mastra/runtime/workflow-snapshot-retention", () => ({
      purgeExpiredWorkflowSnapshots: vi.fn(),
    }));

    try {
      const { startLocalRuntimeWorkers: startExternalWorkers } =
        await import("../../src/mastra/runtime/local-runtime-workers");
      const stop = startExternalWorkers({} as never, undefined, {
        initialDelayMs: 0,
        intervalMs: 10_000,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(requireLocalDatabase).not.toHaveBeenCalled();
      expect(seed).not.toHaveBeenCalled();
      expect(ensureStudioCase).not.toHaveBeenCalled();
      expect(recoverApprovals).toHaveBeenCalledOnce();
      expect(recoverWorkflows).toHaveBeenCalledOnce();
      expect(reconcileRefunds).toHaveBeenCalledOnce();
      expect(reconcileCancellations).toHaveBeenCalledOnce();
      expect(outbox).toHaveBeenCalledOnce();
      expect(recoverCloseIntents).toHaveBeenCalledOnce();
      expect(retention).toHaveBeenCalledOnce();
      await stop();

      delete process.env.APP_MODE;
      process.env.SUPPORT_SOURCE = "intercom";
      process.env.COMMERCE_SOURCE = "mock";
      const legacyStop = startExternalWorkers({} as never, undefined, {
        initialDelayMs: 0,
        intervalMs: 10_000,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(requireLocalDatabase).toHaveBeenCalledOnce();
      expect(seed).toHaveBeenCalledOnce();
      expect(ensureStudioCase).not.toHaveBeenCalled();
      await legacyStop();
    } finally {
      vi.doUnmock("../../src/mastra/lib/case-store");
      vi.doUnmock("../../src/mastra/lib/database-url");
      vi.doUnmock("../../src/mastra/runtime/local-provider");
      vi.doUnmock("../../src/mastra/runtime/native-approval-recovery");
      vi.doUnmock("../../src/mastra/runtime/workflow-recovery");
      vi.doUnmock("../../src/mastra/runtime/outbox");
      vi.doUnmock("../../src/mastra/runtime/studio-seed");
      vi.doUnmock("../../src/mastra/providers/stripe/reconciliation");
      vi.doUnmock(
        "../../src/mastra/providers/stripe/cancellation-reconciliation",
      );
      vi.doUnmock("../../src/mastra/runtime/intercom-close-recovery");
      vi.doUnmock("../../src/mastra/runtime/workflow-snapshot-retention");
      vi.resetModules();
      if (previousAppMode === undefined) delete process.env.APP_MODE;
      else process.env.APP_MODE = previousAppMode;
      if (previousSupportSource === undefined)
        delete process.env.SUPPORT_SOURCE;
      else process.env.SUPPORT_SOURCE = previousSupportSource;
      if (previousCommerceSource === undefined)
        delete process.env.COMMERCE_SOURCE;
      else process.env.COMMERCE_SOURCE = previousCommerceSource;
    }
  });
});
