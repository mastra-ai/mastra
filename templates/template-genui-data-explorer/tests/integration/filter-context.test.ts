import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { WorkspaceAgent } from "../../src/workspace/runtime.ts";
import { createWorkspace } from "../../src/workspace/create.ts";
import type { WorkspaceAction } from "../../src/workspace/contracts.ts";
import { cohortFixture } from "../fixtures/reference.ts";
import { workspaceModel } from "../fixtures/workspace-model.ts";

it("a README cohort request ignores incompatible inherited opportunity filters while preserving saved views", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cohort-filter-context-"));
  const path = join(directory, "sales.sqlite");
  const fixture = cohortFixture(path);
  fixture.db.exec(`
    INSERT INTO accounts VALUES (9,'I','Americas');
    INSERT INTO subscriptions VALUES (10,9);
    INSERT INTO subscription_history VALUES (10,'2025-11-01',10000),(10,'2026-01-01',0);
  `);
  fixture.db.close();
  const period = { start: "2025-10-01", end: "2026-10-01" };
  const provider = workspaceModel({
    choose: (question) =>
      /retention/i.test(question)
        ? {
            component: "heatmap",
            plan: {
              metric: "cohortRetention",
              period,
              groupBy: "cohort",
              ...(/explicit/i.test(question) ? { filters: { segment: "Mid-market" } } : {}),
            },
          }
        : {
            component: "line",
            plan: { metric: "bookings", period, groupBy: "month" },
          },
  });
  const app = await createWorkspace({
    settings: { path },
    workspacePath: join(directory, "workspace.sqlite"),
    memoryPath: join(directory, "memory.sqlite"),
    model: provider.model,
  });
  const ask = async (question: string, action?: WorkspaceAction) => {
    const before = app.engine.snapshot().workspace;
    const runId = randomUUID();
    await new Promise<void>((resolve, reject) =>
      new WorkspaceAgent(app.engine)
        .run({
          runId,
          threadId: before.threadId,
          state: {},
          context: [],
          tools: [],
          messages: [...before.messages, { id: runId, role: "user", content: question }],
          forwardedProps: { baseRevision: before.revision, ...(action ? { action } : {}) },
        })
        .subscribe({ error: reject, complete: resolve }),
    );
    return app.engine.snapshot();
  };
  try {
    expect((await ask("Show monthly bookings")).status).toBe("saved");
    const card = app.engine.snapshot().workspace.components[0]!;
    const filtered = await ask("Filter bookings", {
      type: "filter",
      componentId: card.id,
      field: "segment",
      value: "Mid-market",
    });
    expect(filtered.status, filtered.message).toBe("saved");
    expect(filtered.workspace.filters).toEqual({ segment: "Mid-market" });
    const savedCard = filtered.workspace.components[0];
    const savedResults = filtered.workspace.results;
    const heatmap = await ask(
      "Show a customer retention cohort heatmap for the last twelve complete months",
    );
    expect(heatmap.status, heatmap.message).toBe("saved");
    expect(heatmap.workspace.revision).toBe(3);
    expect(heatmap.workspace.components).toContainEqual(savedCard);
    expect(heatmap.workspace.results).toEqual(expect.arrayContaining(savedResults));
    const cohort = heatmap.workspace.results.find(
      (result) => result.data.metric === "cohortRetention",
    )!;
    expect(cohort.data.request).toEqual({ metric: "cohortRetention", period, groupBy: "cohort" });
    expect(cohort.data.table?.kind).toBe("matrix");
    expect(cohort.data.table?.rows.length).toBeGreaterThan(0);
    expect(heatmap.workspace.components).toContainEqual(
      expect.objectContaining({ component: "heatmap", resultId: cohort.resultId }),
    );
    expect(heatmap.workspace.filters).toEqual({ segment: "Mid-market" });
    const bookings = await ask("Show monthly bookings again");
    const nextBooking = bookings.workspace.results.find(
      (result) => result.data.metric === "bookings",
    )!;
    expect(bookings.status, bookings.message).toBe("saved");
    expect(nextBooking.resultId).not.toBe(savedResults[0]?.resultId);
    expect(nextBooking.data.request.filters).toEqual({ segment: "Mid-market" });
    const rejected = await ask("Show retention with an explicit Mid-market filter");
    expect(rejected.status).toBe("incomplete");
    expect(rejected.message).toContain("does not support the requested fields");
    expect(rejected.workspace).toEqual(bookings.workspace);
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});
