import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { MastraAgent } from "@ag-ui/mastra";
import type { BaseEvent } from "@ag-ui/core";
import { createWorkspace } from "../../src/workspace/create.ts";
import { components, validateComposition } from "../../src/ui/catalog.ts";
import { workspaceId, threadId } from "../../src/workspace/contracts.ts";
import { referenceFixture } from "../fixtures/reference.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";
import { workspaceModel } from "../fixtures/workspace-model.ts";

it("official Mastra adapter streams verified compositions and saves a workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-transport-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const provider = workspaceModel();
  const app = await createWorkspace({
    settings: { path },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    telemetryPath: join(dir, "telemetry.sqlite"),
    model: provider.model,
    catalog: components,
  });
  try {
    const events: BaseEvent[] = [];
    const outcome = await app.engine.run(
      {
        workspaceId,
        threadId,
        requestId: "proof",
        baseRevision: 0,
        question: "Show monthly bookings",
      },
      new AbortController(),
      async (requestContext, session) => {
        const adapter = new MastraAgent({
          agentId: "dataExplorer",
          agent: app.engine.explorer.agent,
          requestContext,
          resourceId: "local-demo-user",
          streamServerToolCalls: true,
        });
        return new Promise((resolve, reject) => {
          const cancel = () => adapter.abortRun();
          session.controller.signal.addEventListener("abort", cancel, { once: true });
          adapter
            .run({
              threadId,
              runId: "proof",
              messages: [{ id: "proof", role: "user", content: "Show monthly bookings" }],
              tools: [],
              context: [],
              state: {},
              forwardedProps: {},
            })
            .subscribe({
              next: (event) => events.push(event),
              error: reject,
              complete: () => {
                session.controller.signal.removeEventListener("abort", cancel);
                resolve({ finishReason: "stop" });
              },
            });
        });
      },
    );
    expect(outcome.snapshot.workspace.revision).toBe(1);
    expect(outcome.snapshot.workspace.results[0]?.data.value).toBe(36000);
    expect(outcome.snapshot.workspace.components[0]?.component).toBe("line");
    expect(events.some((event) => event.type === "TOOL_CALL_RESULT")).toBe(true);
    expect(events.some((event) => event.type === "RUN_FINISHED")).toBe(true);
    expect(provider.calls).toHaveLength(3);
    expect(app.telemetry?.report().usage.filter((event) => event.requestId === "proof")).toEqual([
      {
        requestId: "proof",
        model: "workspace-proof",
        inputTokens: provider.calls.length * 10,
        outputTokens: provider.calls.length * 10,
        estimatedCost: null,
        pricingVersion: null,
        currency: null,
      },
    ]);
    const recalled = await app.memory.recall({
      threadId,
      resourceId: "local-demo-user",
      perPage: 20,
    });
    expect(recalled.total).toBeGreaterThan(0);
  } finally {
    app.telemetry?.close();
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("typed grouped and record data reconcile to independent facts and coverage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-table-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const { SalesSource } = await import("../../data-sources/sales/source.ts");
  const source = new SalesSource(path);
  try {
    const rankedPath = join(dir, "ranked.sqlite");
    const rankedFixture = referenceFixture(rankedPath);
    rankedFixture.db.exec(
      "INSERT INTO opportunities VALUES (6,2,'2025-01-01'); INSERT INTO opportunity_history VALUES (6,'2025-03-15','won',600000,'2025-03-15',2,'Enterprise');",
    );
    rankedFixture.db.close();
    const rankedSource = new SalesSource(rankedPath);
    try {
      const ranking = await rankedSource.execute({
        metric: "conversion",
        period: { start: "2025-03-01", end: "2026-04-01" },
        groupBy: "segment",
      });
      expect(ranking.table?.rows.map((row) => ({ label: row.label, value: row.value }))).toEqual([
        { label: "SMB", value: 100 },
        { label: "Enterprise", value: 50 },
      ]);
    } finally {
      rankedSource.close();
    }
    const period = { start: "2025-03-01", end: "2026-04-01" };
    await expect(
      source.execute({ metric: "bookings", period, groupBy: "department" }),
    ).rejects.toThrow();
    const series = await source.execute({ metric: "bookings", period, groupBy: "month" });
    expect(series.table?.rows).toHaveLength(13);
    expect(series.table?.rows.map((row) => row.value)).toEqual([
      12000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24000,
    ]);
    const records = await source.execute({ metric: "bookings", period, records: true });
    expect(records.table?.rows.map((row) => row.opportunityId)).toEqual([1, 4]);
    expect(records.table?.rows.map((row) => row.value)).toEqual([12000, 24000]);
    const comparison = await source.execute({ metric: "conversion", period, groupBy: "segment" });
    expect(comparison.numerator).toBe(2);
    expect(comparison.denominator).toBe(3);
    expect(comparison.table?.rows.map((row) => ({ label: row.label, value: row.value }))).toEqual([
      { label: "SMB", value: 100 },
      { label: "Enterprise", value: 0 },
    ]);
    const filtered = await source.execute({
      metric: "bookings",
      period,
      groupBy: "month",
      filters: { segment: "Enterprise" },
    });
    expect(filtered.value).toBe(0);
    expect(filtered.table?.rows.every((row) => row.value === 0)).toBe(true);
    const unsupported = await source.execute({
      metric: "bookings",
      period: { start: "2023-01-01", end: "2026-04-01" },
      groupBy: "month",
    });
    expect(unsupported.status).toBe("unavailable");
    expect(unsupported.table).toBeUndefined();
  } finally {
    source.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("fabricated chart values cannot accompany a verified scalar", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-forged-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const { SalesSource } = await import("../../data-sources/sales/source.ts");
  const { DataExplorer } = await import("../../src/analysis/explorer.ts");
  const source = new SalesSource(path);
  const provider = workspaceModel();
  const explorer = new DataExplorer(
    {
      describe: () => source.describe(),
      close: () => source.close(),
      execute: async (request, context) => {
        const result = await source.execute(request, context);
        if (result.table?.rows[0]) result.table.rows[0].value = 999999;
        return result;
      },
    },
    provider.model,
    { catalog: components },
  );
  try {
    const outcome = await explorer.analyze({
      workspaceId,
      threadId,
      requestId: "forged",
      baseRevision: 0,
      question: "Show monthly bookings",
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.code).toBe("invalid-result");
    expect(outcome.results).toEqual([]);
  } finally {
    await explorer.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("workspace transactions preserve complete state on real store failure and restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-save-"));
  const salesPath = join(dir, "sales.sqlite");
  referenceFixture(salesPath).db.close();
  const workspacePath = join(dir, "workspace.sqlite"),
    memoryPath = join(dir, "memory.sqlite");
  const provider = workspaceModel();
  let app = await createWorkspace({
    settings: { path: salesPath },
    workspacePath,
    memoryPath,
    model: provider.model,
  });
  async function ask(requestId: string, baseRevision: number) {
    return app.engine.run(
      { workspaceId, threadId, requestId, baseRevision, question: "Show monthly bookings" },
      new AbortController(),
      async (requestContext, session) => {
        const bridge = new MastraAgent({
          agentId: "dataExplorer",
          agent: app.engine.explorer.agent,
          requestContext,
          resourceId: "local-demo-user",
        });
        return new Promise((resolve, reject) => {
          const cancel = () => bridge.abortRun();
          session.controller.signal.addEventListener("abort", cancel, { once: true });
          bridge
            .run({
              threadId,
              runId: requestId,
              messages: [{ id: requestId, role: "user", content: "Show monthly bookings" }],
              tools: [],
              context: [],
              state: {},
              forwardedProps: {},
            })
            .subscribe({
              error: reject,
              complete: () => {
                session.controller.signal.removeEventListener("abort", cancel);
                resolve({ finishReason: "stop" });
              },
            });
        });
      },
    );
  }
  try {
    expect((await ask("first", 0)).snapshot.workspace.revision).toBe(1);
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(workspacePath);
    db.exec(
      "CREATE TRIGGER deny_save BEFORE INSERT ON workspaces BEGIN SELECT RAISE(ABORT,'synthetic store failure'); END;",
    );
    const failed = await ask("failed", 1);
    expect(failed.snapshot.workspace.revision).toBe(1);
    expect(failed.snapshot.status).toBe("incomplete");
    expect(failed.snapshot.message).toContain("save failed");
    const calls = provider.calls.length;
    const duplicate = await ask("failed", 1);
    expect(duplicate.duplicate).toBe(true);
    expect(provider.calls).toHaveLength(calls);
    await expect(
      app.engine.run(
        {
          workspaceId,
          threadId,
          requestId: "failed",
          baseRevision: 1,
          question: "Different input",
        },
        new AbortController(),
        async () => ({ finishReason: "stop" }),
      ),
    ).rejects.toThrow("different input");
    db.exec("DROP TRIGGER deny_save");
    db.close();
    await app.engine.close();
    await app.storage.close();
    const fresh = workspaceModel();
    app = await createWorkspace({
      settings: { path: salesPath },
      workspacePath,
      memoryPath,
      model: fresh.model,
    });
    expect(app.engine.snapshot().workspace.revision).toBe(1);
    expect(app.engine.snapshot().status).toBe("incomplete");
    expect(fresh.calls).toHaveLength(0);
    expect(
      (await app.memory.recall({ threadId, resourceId: "local-demo-user", perPage: 50 })).total,
    ).toBeGreaterThan(0);
    const retried = await ask("retry", 1);
    expect(retried.snapshot.message).toBe("Saved revision 2.");
    expect(retried.snapshot.workspace.revision).toBe(2);
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("enabled catalog validates bindings and custom display schemas", async () => {
  const { validateCatalog, validateComposition } = await import("../../src/ui/catalog.ts");
  expect(() => validateCatalog([...components, components[0]!])).toThrow("duplicate");
  const dir = await mkdtemp(join(tmpdir(), "workspace-catalog-"));
  const salesPath = join(dir, "sales.sqlite");
  referenceFixture(salesPath).db.close();
  const catalog = components.map((entry) => ({
    ...entry,
    enabled: entry.id === "compact" || entry.id === "table",
  }));
  const app = await createWorkspace({
    settings: { path: salesPath },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    model: workspaceModel({ component: "compact" }).model,
    catalog,
  });
  try {
    const question = {
      workspaceId,
      threadId,
      requestId: "custom",
      baseRevision: 0,
      question: "Show a compact metric",
    };
    const completed = await app.engine.run(
      question,
      new AbortController(),
      async (requestContext, session) => {
        const adapter = new MastraAgent({
          agentId: "dataExplorer",
          agent: app.engine.explorer.agent,
          requestContext,
          resourceId: "local-demo-user",
        });
        return new Promise((resolve, reject) => {
          const cancel = () => adapter.abortRun();
          session.controller.signal.addEventListener("abort", cancel, { once: true });
          adapter
            .run({
              threadId,
              runId: question.requestId,
              messages: [{ id: question.requestId, role: "user", content: question.question }],
              tools: [],
              context: [],
              state: {},
              forwardedProps: {},
            })
            .subscribe({
              error: reject,
              complete: () => {
                session.controller.signal.removeEventListener("abort", cancel);
                resolve({ finishReason: "stop" });
              },
            });
        });
      },
    );
    const binding = completed.snapshot.workspace.components[0]!;
    const results = completed.snapshot.workspace.results;
    expect(binding.component).toBe("compact");
    expect(binding.properties.options?.emphasis).toBe("verified");
    expect(() =>
      validateComposition({ components: [{ ...binding, component: "line" }] }, results, catalog),
    ).toThrow("disabled");
    expect(() =>
      validateComposition({ components: [{ ...binding, resultId: "forged" }] }, results, catalog),
    ).toThrow("unverified");
    expect(() =>
      validateComposition(
        {
          components: [
            { ...binding, properties: { ...binding.properties, options: { emphasis: "made up" } } },
          ],
        },
        results,
        catalog,
      ),
    ).toThrow();
    expect(() =>
      app.engine.validateAction(
        { type: "filter", componentId: binding.id, field: "segment", value: "SMB" },
        completed.snapshot.workspace,
      ),
    ).toThrow("action");
    expect(
      app.engine.validateAction(
        { type: "compare", componentId: binding.id, segment: "Enterprise" },
        completed.snapshot.workspace,
      ).request.filters,
    ).toEqual({ segment: "Enterprise" });
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("workspace factory reuses configured non-SQL registrations and source settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-source-"));
  const reference = new ReferenceSource();
  const source = {
    describe: () => {
      const descriptor = reference.describe();
      descriptor.capabilities[0]!.fields.push("groupBy");
      descriptor.capabilities[0]!.groupings = [{ field: "department", kind: "ranked" }];
      return descriptor;
    },
    execute: async (request: import("../../data-sources/source.ts").AnalysisRequest) => {
      const result = await reference.execute({
        metric: request.metric,
        ...(request.period ? { period: request.period } : {}),
      });
      result.request = request;
      result.table = {
        kind: "ranked",
        omitted: 0,
        columns: [
          { key: "label", label: "Department", type: "category" },
          { key: "value", label: "Won value", type: "number", unit: "USD cents" },
          { key: "numerator", label: "Won value", type: "number" },
          { key: "denominator", label: "Closed opportunities", type: "number" },
        ],
        rows: [{ label: "Research", value: 12000, numerator: 12000, denominator: 2 }],
      };
      return result;
    },
    close: () => reference.close(),
  };
  const app = await createWorkspace({
    sourceId: "reference",
    registrations: [
      {
        id: "reference",
        open: (settings) => {
          expect(settings).toEqual({ account: "fixture" });
          return source;
        },
      },
    ],
    settings: { account: "fixture" },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    model: workspaceModel().model,
  });
  try {
    const outcome = await app.engine.run(
      {
        workspaceId,
        threadId,
        requestId: "reference",
        baseRevision: 0,
        question: "Inspect reference facts",
      },
      new AbortController(),
      async (context, session) => {
        const run = await app.engine.explorer.workflow.createRun({
          runId: "reference",
          shouldPersistSnapshot: () => false,
        });
        session.workflowRunId = run.runId;
        const output = await run.start({
          inputData: {
            metric: "bookings",
            groupBy: "department",
            period: { start: "2025-03-01", end: "2025-04-01" },
          },
          requestContext: context,
        });
        if (output.status !== "success") throw new Error("Reference workflow did not complete.");
        session.composition = validateComposition(
          {
            components: [
              {
                id: "reference",
                component: "metric",
                version: "1",
                resultId: output.result.resultId,
                properties: { title: "Reference facts" },
              },
            ],
          },
          session.results,
          components,
        );
        return { finishReason: "stop" };
      },
    );
    expect(outcome.snapshot.status).toBe("saved");
    expect(outcome.snapshot.workspace.source.id).toBe("reference");
    expect(outcome.snapshot.workspace.results[0]?.data.value).toBe(12000);
    expect(outcome.snapshot.workspace.results[0]?.data.provenance.operations[0]?.kind).toBe("read");
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
  expect(reference.closed).toBe(true);
});
