import { DatabaseSync } from "node:sqlite";
import { WorkspaceAgent } from "../../src/workspace/runtime.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { MastraAgent } from "@ag-ui/mastra";
import type { BaseEvent } from "@ag-ui/core";
import { createWorkspace } from "../../src/workspace/create.ts";
import { components, validateComposition, compositionInputSchema } from "../../src/ui/catalog.ts";
import { z } from "zod";
import { workspaceId, threadId } from "../../src/workspace/contracts.ts";
import { referenceFixture, cohortFixture } from "../fixtures/reference.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";
import { workspaceModel } from "../fixtures/workspace-model.ts";
import { deterministicOpenAI } from "../fixtures/openai-server.ts";
import { DataExplorer } from "../../src/analysis/explorer.ts";
import { SalesSource } from "../../data-sources/sales/source.ts";
import { analysisModel } from "../fixtures/analysis-model.ts";

it("card removal is durable, revision-checked and independent of model calls", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-dismiss-"));
  const salesPath = join(dir, "sales.sqlite");
  referenceFixture(salesPath).db.close();
  const provider = workspaceModel();
  const settings = {
    settings: { path: salesPath },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    model: provider.model,
  };
  let app = await createWorkspace(settings);
  try {
    const question = {
      workspaceId,
      threadId,
      requestId: "original",
      baseRevision: 0,
      question: "Show monthly bookings",
    };
    await app.engine.run(question, new AbortController(), async (requestContext, session) => {
      const result = await app.engine.explorer.agent.generate(question.question, {
        requestContext,
        abortSignal: session.controller.signal,
      });
      return { finishReason: result.finishReason };
    });
    const original = app.engine.snapshot().workspace;
    expect(original.revision).toBe(1);
    expect(original.cardTurns?.[original.components[0]!.id]).toBe("original");
    expect(original.messages.at(-1)?.content).toContain("$360.00");
    expect(original.messages.at(-1)?.content).not.toContain("USD cents");
    const action = { type: "dismiss" as const, componentId: original.components[0]!.id };
    const calls = provider.calls.length;
    const dismiss = { ...question, requestId: "dismiss", baseRevision: 1 };
    const execute = async () => {
      throw new Error("Dismissal must not call the model.");
    };
    const result = await app.engine.run(dismiss, new AbortController(), execute, action);
    expect(result.snapshot.workspace.components).toEqual([]);
    expect(result.snapshot.workspace.results).toEqual([]);
    expect(result.snapshot.workspace.messages).toEqual(original.messages);
    expect(provider.calls).toHaveLength(calls);
    expect((await app.engine.run(dismiss, new AbortController(), execute, action)).duplicate).toBe(
      true,
    );
    await expect(
      app.engine.run({ ...dismiss, requestId: "stale" }, new AbortController(), execute, action),
    ).rejects.toThrow("older revision");
    await app.engine.close();
    await app.storage.close();
    app = await createWorkspace(settings);
    expect(app.engine.snapshot().workspace).toMatchObject({
      revision: 2,
      components: [],
      results: [],
    });
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("record inspection restores the saved overview and filters after restart without another read", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-back-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const provider = workspaceModel({ cardId: "constructor" });
  let reads = 0;
  const settings = {
    settings: { path },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    model: provider.model,
    registrations: [
      {
        id: "sales",
        open: () => {
          const source = new SalesSource(path);
          return {
            describe: () => source.describe(),
            execute: (...args: Parameters<SalesSource["execute"]>) => {
              reads++;
              return source.execute(...args);
            },
            close: () => source.close(),
          };
        },
      },
    ],
  };
  let app = await createWorkspace(settings);
  const question = {
    workspaceId,
    threadId,
    requestId: "overview",
    baseRevision: 0,
    question: "Show monthly bookings",
  };
  const execute: Parameters<typeof app.engine.run>[2] = async (requestContext, session) => {
    const result = await app.engine.explorer.agent.generate(question.question, {
      requestContext,
      abortSignal: session.controller.signal,
    });
    return { finishReason: result.finishReason };
  };
  const noModel = async () => {
    throw new Error("Saved overview restoration must not call the model.");
  };
  try {
    await app.engine.run(question, new AbortController(), execute);
    const id = app.engine.snapshot().workspace.components[0]!.id;
    await expect(
      app.engine.run(
        { ...question, requestId: "no-backup", baseRevision: 1 },
        new AbortController(),
        noModel,
        { type: "back", componentId: id },
      ),
    ).rejects.toThrow("No saved overview");
    await app.engine.run(
      { ...question, requestId: "filter", baseRevision: 1 },
      new AbortController(),
      noModel,
      { type: "filter", componentId: id, field: "segment", value: "SMB" },
    );
    const overview = app.engine.snapshot().workspace;
    await app.engine.run(
      { ...question, requestId: "inspect", baseRevision: 2 },
      new AbortController(),
      noModel,
      { type: "drill", componentId: id, label: "2025-03-01" },
    );
    const inspected = app.engine.snapshot().workspace;
    expect(inspected.results[0]?.data.table?.rows.map((row) => row.opportunityId)).toEqual([1]);
    expect(inspected.drillBack?.[id]?.binding).toEqual(overview.components[0]);
    expect(inspected.drillBack?.[id]?.result).toEqual(overview.results[0]);
    await app.engine.close();
    await app.storage.close();
    app = await createWorkspace(settings);
    const calls = provider.calls.length;
    const sourceReads = reads;
    const back = { ...question, requestId: "back", baseRevision: 3 };
    const action = { type: "back" as const, componentId: id };
    const restored = await app.engine.run(back, new AbortController(), noModel, action);
    expect(restored.snapshot.workspace.components).toEqual(overview.components);
    expect(restored.snapshot.workspace.results).toEqual(overview.results);
    expect(restored.snapshot.workspace.filters).toEqual({ segment: "SMB" });
    expect(restored.snapshot.workspace.messages).toEqual(inspected.messages);
    expect(restored.snapshot.workspace.drillBack).toEqual({});
    expect(provider.calls).toHaveLength(calls);
    expect(reads).toBe(sourceReads);
    expect((await app.engine.run(back, new AbortController(), noModel, action)).duplicate).toBe(
      true,
    );
    await expect(
      app.engine.run({ ...back, requestId: "stale-back" }, new AbortController(), noModel, action),
    ).rejects.toThrow("older revision");
    await expect(
      app.engine.run(
        { ...back, requestId: "no-overview", baseRevision: 4 },
        new AbortController(),
        noModel,
        action,
      ),
    ).rejects.toThrow("No saved overview");
    expect(app.engine.snapshot().workspace.revision).toBe(4);
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("references to existing charts do not block requested record and table views", async () => {
  const dir = await mkdtemp(join(tmpdir(), "chart-refinement-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const provider = workspaceModel({
    choose: (question) => ({
      component: "table",
      plan: {
        metric: "bookings",
        period: { start: "2025-03-01", end: "2025-04-01" },
        ...(/records|rows/i.test(question) ? { records: true } : { groupBy: "month" }),
      },
    }),
  });
  const explorer = new DataExplorer(new SalesSource(path), provider.model, { catalog: components });
  try {
    for (const question of [
      "Show the records behind this chart",
      "Show the data behind this chart in a table",
      "Show this chart as a table",
      "Show this heatmap as a table",
      "From this graph, show the records",
      "Show the data behind this chart",
      "Convert this chart into a table",
      "Show the records in the chart",
    ]) {
      let published = false;
      const result = await explorer.analyze(
        { workspaceId, threadId, requestId: question, baseRevision: 0, question },
        {
          onComplete: () => {
            published = true;
          },
        },
      );
      expect(result.status, question).toBe("complete");
      expect(published, question).toBe(true);
      expect(result.results[0]?.data.value).toBe(12000);
    }
    const result = await explorer.analyze({
      workspaceId,
      threadId,
      requestId: "chart-output",
      baseRevision: 0,
      question: "Show a chart of bookings for March 2025",
    });
    expect(result.status).toBe("unsupported");
    expect(result.message).toContain("did not produce chart data");
  } finally {
    await explorer.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("chart capability checks reject aggregate substitutes and preserve supported filtered cohorts", async () => {
  const provider = workspaceModel({
    choose: (question) =>
      /churn/i.test(question)
        ? {
            component: "metric",
            plan: { metric: "customerChurn", period: { start: "2025-03-01", end: "2025-04-01" } },
          }
        : {
            component: "line",
            plan: {
              metric: "bookings",
              period: { start: "2025-03-01", end: "2025-04-01" },
              groupBy: "month",
              filters: { segment: "Enterprise" },
            },
          },
  });
  const dir = await mkdtemp(join(tmpdir(), "cohort-request-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const explorer = new DataExplorer(new SalesSource(path), provider.model, { catalog: components });
  try {
    let published = false;
    const question = {
      workspaceId,
      threadId,
      requestId: "cohort",
      baseRevision: 0,
      question: "show a cohort chart of churn for last 12 months",
    };
    const result = await explorer.analyze(question, {
      onComplete: () => {
        published = true;
      },
    });
    expect(result.status).toBe("unsupported");
    expect(result.message).toContain("did not produce chart data");
    expect(published).toBe(false);
    expect(explorer.lastComplete(workspaceId)).toEqual([]);
    const supported = await explorer.analyze({
      ...question,
      requestId: "filtered-cohort",
      question: "Show a bookings chart for the Enterprise cohort grouped by month in March 2025",
    });
    expect(supported.status).toBe("complete");
    expect(supported.results[0]?.data.request).toMatchObject({
      groupBy: "month",
      filters: { segment: "Enterprise" },
    });
    const saved = explorer.lastComplete(workspaceId);
    const heatmap = await explorer.analyze({
      ...question,
      requestId: "heatmap",
      question: "Show a bookings heatmap for March 2025",
    });
    expect(heatmap.status).toBe("unsupported");
    expect(heatmap.message).toContain("did not produce a verified matrix");
    expect(explorer.lastComplete(workspaceId)).toEqual(saved);
  } finally {
    await explorer.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("a verified scalar cannot complete a visual request without composition", async () => {
  const provider = analysisModel([
    { metric: "bookings", period: { start: "2025-03-01", end: "2025-04-01" } },
  ]);
  const explorer = new DataExplorer(new ReferenceSource(), provider.model, { catalog: components });
  let saved = false;
  try {
    const outcome = await explorer.analyze(
      {
        workspaceId,
        threadId,
        requestId: "missing-composition",
        baseRevision: 0,
        question: "Show bookings as a metric card",
      },
      {
        onComplete: () => {
          saved = true;
        },
      },
    );
    expect(outcome).toMatchObject({ status: "failed", code: "invalid-composition" });
    expect(saved).toBe(false);
    expect(explorer.lastComplete(workspaceId)).toEqual([]);
    expect(provider.calls[1]?.toolChoice).toEqual({ type: "required" });
  } finally {
    await explorer.close();
  }
});

it("OpenAI optional null arguments produce a verified composed result", async () => {
  const dir = await mkdtemp(join(tmpdir(), "provider-arguments-"));
  const path = join(dir, "sales.sqlite");
  const fixture = referenceFixture(path);
  fixture.db.exec(
    "INSERT INTO opportunities VALUES (6,2,'2025-01-01'); INSERT INTO opportunity_history VALUES (6,'2025-03-15','won',6000,'2025-03-15',2,'Enterprise');",
  );
  fixture.db.close();
  const provider = deterministicOpenAI();
  await new Promise<void>((resolve) => provider.server.listen(0, "127.0.0.1", resolve));
  const address = provider.server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address.");
  const explorer = new DataExplorer(
    new SalesSource(path),
    {
      providerId: "openai",
      modelId: "gpt-4.1-mini",
      apiKey: "synthetic-local-provider",
      url: `http://127.0.0.1:${address.port}/v1`,
      api: "chat",
    },
    { catalog: components },
  );
  let composed = false;
  try {
    const outcome = await explorer.analyze(
      {
        workspaceId,
        threadId,
        requestId: "nullable-provider",
        baseRevision: 0,
        question: "Show monthly bookings",
      },
      {
        onComplete: (session) => {
          composed = session.composition?.components[0]?.component === "line";
        },
      },
    );
    expect(outcome.status).toBe("complete");
    expect(outcome.results[0]?.data.value).toBe(42000);
    expect(outcome.results[0]?.data.request).toEqual({
      metric: "bookings",
      period: explorer.describe().coverage,
      groupBy: "month",
    });
    expect(composed).toBe(true);
    expect(provider.stages.map((stage) => stage.tools)).toEqual([0, 1, 2]);
    const filtered = await explorer.analyze({
      workspaceId,
      threadId,
      requestId: "nullable-filters",
      baseRevision: 0,
      question: "Show SMB monthly bookings",
    });
    expect(filtered.status).toBe("complete");
    expect(filtered.results[0]?.data.request.filters).toStrictEqual({ segment: "SMB" });
    expect(filtered.results[0]?.data.value).toBe(36000);
    let churnComposition: unknown;
    const churn = await explorer.analyze(
      {
        workspaceId,
        threadId,
        requestId: "monthly-customer-churn",
        baseRevision: 0,
        question: "Show monthly customer churn for the last 12 complete months",
      },
      {
        onComplete: (session) => {
          churnComposition = session.composition;
        },
      },
    );
    expect(churn.status, churn.message).toBe("complete");
    expect(churn.results[0]?.data.request).toEqual({
      metric: "customerChurn",
      period: { start: "2025-10-01", end: "2026-10-01" },
      groupBy: "month",
    });
    expect(churn.results[0]?.data.table?.rows).toHaveLength(12);
    const valid = validateComposition(churnComposition, churn.results, components);
    const binding = valid.components[0]!;
    expect(binding).toMatchObject({ component: "line", properties: { x: "month", y: "value" } });
    const schema = compositionInputSchema(churn.results, components);
    expect(schema.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { ...binding, component: "heatmap" },
      { ...binding, component: "bar" },
      { ...binding, version: "unregistered" },
      { ...binding, resultId: "forged" },
      { ...binding, properties: { ...binding.properties, x: "period" } },
      { ...binding, properties: { ...binding.properties, y: "numerator" } },
      { ...binding, properties: { ...binding.properties, value: "value" } },
    ])
      expect(schema.safeParse({ components: [invalid] }).success).toBe(false);
    const candidateSchema = z
      .object({
        properties: z.object({
          components: z.object({
            items: z.object({
              anyOf: z.array(
                z.object({
                  properties: z.object({
                    component: z.object({ const: z.string() }),
                    version: z.object({ const: z.string() }),
                    resultId: z.object({ const: z.string() }),
                    properties: z.object({ properties: z.record(z.string(), z.unknown()) }),
                  }),
                }),
              ),
            }),
          }),
        }),
      })
      .parse(provider.compositionSchemas.at(-1));
    const candidates = candidateSchema.properties.components.items.anyOf;
    expect(
      candidates.every((candidate) => candidate.properties.resultId.const === binding.resultId),
    ).toBe(true);
    expect(candidates.every((candidate) => candidate.properties.version.const === "1")).toBe(true);
    expect(candidates.map((candidate) => candidate.properties.component.const)).not.toContain(
      "heatmap",
    );
    const line = candidates.find((candidate) => candidate.properties.component.const === "line")!;
    expect(line.properties.properties.properties).toMatchObject({
      x: { const: "month" },
      y: { enum: ["value"] },
    });
    expect(line.properties.properties.properties).not.toHaveProperty("value");
  } finally {
    await explorer.close();
    await new Promise<void>((resolve, reject) =>
      provider.server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(dir, { recursive: true, force: true });
  }
});

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

it("Mastra composes verified continuous-retention and cumulative-churn cohorts as registered heatmaps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cohort-composition-"));
  const path = join(dir, "sales.sqlite");
  cohortFixture(path).db.close();
  const period = { start: "2025-01-01", end: "2025-04-01" };
  const provider = workspaceModel({
    choose: (question) => ({
      component: /table/i.test(question) ? "table" : "heatmap",
      plan: {
        metric: /churn/i.test(question) ? "cohortChurn" : "cohortRetention",
        period,
        groupBy: "cohort",
      },
    }),
  });
  const explorer = new DataExplorer(new SalesSource(path), provider.model, { catalog: components });
  try {
    for (const question of [
      "Show a cohort retention heatmap",
      "Show a cohort chart of churn",
      "Show customer retention cohorts in a table",
    ]) {
      let composed = false;
      const outcome = await explorer.analyze(
        { workspaceId, threadId, requestId: question, baseRevision: 0, question },
        {
          onComplete: (session) => {
            expect(session.composition?.components[0]).toMatchObject({
              component: /table/i.test(question) ? "table" : "heatmap",
            });
            if (!/table/i.test(question))
              expect(session.composition?.components[0]?.properties).toMatchObject({
                x: "age",
                y: "cohort",
                value: "value",
              });
            composed = true;
          },
        },
      );
      expect(outcome.status, outcome.message).toBe("complete");
      expect(composed).toBe(true);
      expect(outcome.results[0]?.data.value).toBe(/churn/i.test(question) ? 60 : 40);
    }
    const prompt = JSON.stringify(provider.calls);
    expect(prompt).toContain('"role":"matrix"');
    expect(prompt).not.toContain('"reactivatedCustomers":2');
  } finally {
    await explorer.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("result-bound composition preserves custom properties without axes and object refinements", async () => {
  const dir = await mkdtemp(join(tmpdir(), "custom-composition-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const custom = {
    ...components.find((entry) => entry.id === "metric")!,
    id: "audited-metric",
    properties: z
      .strictObject({
        title: z.string(),
        options: z.strictObject({ emphasis: z.enum(["verified", "audited"]) }),
      })
      .refine((value) => value.title === "Verified metric", "Use the registered metric label."),
  };
  const provider = workspaceModel({
    component: custom.id,
    properties: { title: "Verified metric", options: { emphasis: "audited" } },
  });
  const explorer = new DataExplorer(new SalesSource(path), provider.model, { catalog: [custom] });
  let composition: unknown;
  try {
    const outcome = await explorer.analyze(
      {
        workspaceId,
        threadId,
        requestId: "custom-refinement",
        baseRevision: 0,
        question: "Show verified bookings",
      },
      {
        onComplete: (session) => {
          composition = session.composition;
        },
      },
    );
    expect(outcome.status, outcome.message).toBe("complete");
    const accepted = validateComposition(composition, outcome.results, [custom]);
    const schema = compositionInputSchema(outcome.results, [custom]);
    expect(schema.safeParse(accepted).success).toBe(true);
    const binding = accepted.components[0]!;
    for (const properties of [
      { title: "Unregistered metric label", options: { emphasis: "audited" } },
      { title: "Verified metric", options: { emphasis: "made up" } },
      { title: "Verified metric", options: { emphasis: "audited" }, x: "month" },
    ])
      expect(schema.safeParse({ components: [{ ...binding, properties }] }).success).toBe(false);
  } finally {
    await explorer.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("new chats persist empty sessions and isolate history, memory, filters, replay and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-sessions-"));
  const path = join(dir, "sales.sqlite");
  referenceFixture(path).db.close();
  const provider = workspaceModel({ delayMs: 150 });
  const settings = {
    settings: { path },
    workspacePath: join(dir, "workspace.sqlite"),
    memoryPath: join(dir, "memory.sqlite"),
    model: provider.model,
  };
  let app = await createWorkspace(settings);
  const execute = (
    workspace: ReturnType<typeof app.engine.snapshot>["workspace"],
    requestId: string,
    question: string,
  ) => {
    const agent = new WorkspaceAgent(app.engine);
    return new Promise<BaseEvent[]>((resolve) => {
      const events: BaseEvent[] = [];
      agent
        .run({
          threadId: workspace.threadId,
          runId: requestId,
          messages: [...workspace.messages, { id: requestId, role: "user", content: question }],
          state: {},
          context: [],
          tools: [],
          forwardedProps: { baseRevision: workspace.revision },
        })
        .subscribe({ next: (event) => events.push(event), complete: () => resolve(events) });
    });
  };
  try {
    const legacy = app.engine.snapshot().workspace;
    await execute(legacy, "shared-request", "Show monthly bookings LEGACY_MARKER");
    const previous = app.engine.snapshot().workspace;
    const calls = provider.calls.length;
    const fresh = app.engine.createSession().workspace;
    const unused = app.engine.createSession().workspace;
    expect(provider.calls).toHaveLength(calls);
    expect(fresh).toMatchObject({
      revision: 0,
      messages: [],
      components: [],
      results: [],
      filters: {},
    });
    expect(fresh.id).not.toBe(previous.id);
    expect(fresh.threadId).not.toBe(previous.threadId);
    expect(app.engine.snapshot().workspace).toEqual(previous);
    expect(app.engine.snapshot().sessions).toHaveLength(3);
    const start = provider.calls.length;
    await execute(fresh, "shared-request", "Show monthly bookings FRESH_MARKER");
    expect(JSON.stringify(provider.calls.slice(start))).not.toContain("LEGACY_MARKER");
    const accepted = app.engine.snapshot(fresh.id).workspace;
    expect(accepted.revision).toBe(1);
    expect(accepted.messages[0]?.content).toContain("FRESH_MARKER");
    expect(
      app.engine.snapshot(fresh.id).sessions.find((session) => session.id === fresh.id)?.title,
    ).toContain("FRESH_MARKER");
    const recalled = await app.memory.recall({
      threadId: fresh.threadId,
      resourceId: "local-demo-user",
      perPage: 50,
    });
    expect(JSON.stringify(recalled)).toContain("FRESH_MARKER");
    expect(JSON.stringify(recalled)).not.toContain("LEGACY_MARKER");
    const originalMemory = await app.memory.recall({
      threadId: previous.threadId,
      resourceId: "local-demo-user",
      perPage: 50,
    });
    expect(JSON.stringify(originalMemory)).toContain("LEGACY_MARKER");
    expect(JSON.stringify(originalMemory)).not.toContain("FRESH_MARKER");
    const noModel = async () => {
      throw new Error("An interaction must not invoke a model.");
    };
    const filter = {
      workspaceId: fresh.id,
      threadId: fresh.threadId,
      requestId: "filter",
      baseRevision: 1,
      question: "Apply a filter",
    };
    const action = {
      type: "filter" as const,
      componentId: accepted.components[0]!.id,
      field: "segment" as const,
      value: "SMB",
    };
    await app.engine.run(filter, new AbortController(), noModel, action);
    expect(app.engine.snapshot(fresh.id).workspace.filters).toEqual({ segment: "SMB" });
    expect(app.engine.snapshot().workspace).toEqual(previous);
    expect((await app.engine.run(filter, new AbortController(), noModel, action)).duplicate).toBe(
      true,
    );
    await expect(
      app.engine.run(
        { ...filter, requestId: "mismatch", threadId },
        new AbortController(),
        noModel,
      ),
    ).rejects.toThrow("matching thread");
    expect(() => app.engine.snapshot("unknown")).toThrow("unavailable");
    expect(() => app.engine.sessionForThread("unknown")).toThrow("unavailable");
    const unknown = await execute({ ...fresh, threadId: "unknown" }, "forged", "Show bookings");
    expect(unknown.some((event) => event.type === "RUN_ERROR")).toBe(true);
    // Matching request IDs in different chats cannot cancel one another.
    const crossed = await execute(
      { ...fresh, messages: previous.messages },
      "crossed-history",
      "Show bookings",
    );
    expect(crossed.some((event) => event.type === "RUN_ERROR")).toBe(true);
    const cancelled = execute(
      app.engine.snapshot(fresh.id).workspace,
      "parallel",
      "Show slow monthly bookings CANCEL_MARKER",
    );
    const running = execute(unused, "parallel", "Show slow monthly bookings OTHER_MARKER");
    await new Promise((resolve) => setTimeout(resolve, 30));
    app.engine.cancel("parallel", fresh.id);
    await Promise.all([running, cancelled]);
    expect(app.engine.snapshot(fresh.id).status).toBe("incomplete");
    expect(app.engine.snapshot(unused.id).workspace.revision).toBe(1);
    expect(app.engine.snapshot(fresh.id).workspace.revision).toBe(2);
    const empty = app.engine.createSession().workspace;
    const before = app.engine.snapshot().sessions;
    const db = new DatabaseSync(settings.workspacePath);
    try {
      db.exec(
        "CREATE TRIGGER deny_new_chat BEFORE INSERT ON workspaces BEGIN SELECT RAISE(ABORT,'test failure'); END;",
      );
      expect(() => app.engine.createSession()).toThrow("Could not create");
      expect(app.engine.snapshot().sessions).toEqual(before);
      db.exec("DROP TRIGGER deny_new_chat;");
    } finally {
      db.close();
    }
    await app.engine.close();
    await app.storage.close();
    app = await createWorkspace(settings);
    expect(app.engine.snapshot(empty.id).workspace).toEqual(empty);
    expect(app.engine.snapshot(fresh.id).workspace).toMatchObject({
      revision: 2,
      filters: { segment: "SMB" },
    });
    expect(app.engine.snapshot().workspace).toEqual(previous);
    expect(app.engine.snapshot().sessions).toHaveLength(4);
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});
