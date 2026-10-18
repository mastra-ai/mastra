import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { WorkspaceAgent } from "../../src/workspace/runtime.ts";
import { createWorkspace } from "../../src/workspace/create.ts";
import type { WorkspaceAction } from "../../src/workspace/contracts.ts";
import { workspaceModel } from "../fixtures/workspace-model.ts";
import { EducationSource, educationPeriod } from "../fixtures/education-source.ts";
import { components } from "../../src/components/catalog.ts";
import { validateComposition } from "../../src/analysis/composition.ts";
import { chartPoints } from "../../src/ui/charts/shared.ts";
import { humanAnswer } from "../../src/components/format.ts";

it("education drives agent composition, typed actions, daily drill, matrices and saved views without UI registration changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "education-domain-"));
  const source = new EducationSource();
  const provider = workspaceModel({
    choose: (question) => ({
      component: /matrix/.test(question)
        ? "heatmap"
        : /ranking/.test(question)
          ? "bar"
          : /completion|projection/.test(question)
            ? "metric"
            : "line",
      cardId: question,
      scenario: /projection/.test(question),
      plan: {
        metric: /completion/.test(question)
          ? "completion"
          : /projection/.test(question)
            ? "projectedEnrollment"
            : "enrollments",
        period: educationPeriod,
        ...(/matrix/.test(question)
          ? { groupBy: "courseCampus" }
          : /ranking/.test(question)
            ? { groupBy: "schoolId" }
            : /completion|projection/.test(question)
              ? {}
              : { groupBy: "teachingDay" }),
      },
    }),
  });
  const configuration = {
    sourceId: "education",
    registrations: [{ id: "education", open: () => source }],
    workspacePath: join(directory, "workspace.sqlite"),
    memoryPath: join(directory, "memory.sqlite"),
    model: provider.model,
  };
  let app = await createWorkspace(configuration);
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
    const next = app.engine.snapshot();
    expect(next.status, next.message).toBe("saved");
    expect(next.workspace.revision).toBe(before.revision + 1);
    return next.workspace;
  };
  try {
    let workspace = await ask("daily");
    expect(workspace.components[0]?.component).toBe("line");
    expect(workspace.results[0]?.data.value).toBe(6);
    expect(humanAnswer(workspace.results[0]!.data)).toContain("Student enrollment: 6 students");
    expect(JSON.stringify(provider.calls[0]?.prompt)).not.toMatch(
      /Sales|bookings|opportunity|customer churn/,
    );
    expect(
      app.engine.validateAction(
        { type: "drill", componentId: "daily", label: "2025-03-02" },
        workspace,
      ).request.period,
    ).toEqual({ start: "2025-03-02", end: "2025-03-03" });
    workspace = await ask("filter", {
      type: "filter",
      componentId: "daily",
      field: "schoolId",
      value: 10,
    });
    expect(workspace.results[0]?.data.value).toBe(4);
    expect(workspace.filters).toEqual({ schoolId: 10 });
    workspace = await ask("compare", {
      type: "compare",
      componentId: "daily",
      field: "schoolId",
      value: 20,
    });
    expect(workspace.results.map((result) => result.data.value)).toEqual([4, 2]);
    expect(workspace.filters).toEqual({ schoolId: 10 });
    expect(() =>
      app.engine.validateAction(
        { type: "compare", componentId: "daily", field: "segment", value: "Enterprise" },
        workspace,
      ),
    ).toThrow("supported filter");
    expect(() =>
      app.engine.validateAction(
        { type: "filter", componentId: "daily", field: "schoolId", value: "10" },
        workspace,
      ),
    ).toThrow("supported filter");
    workspace = await ask("clear", { type: "filter", componentId: "daily", field: "schoolId" });
    workspace = await ask("matrix");
    const matrix = workspace.results.find((result) => result.data.table?.kind === "matrix")!;
    expect(matrix.data.value).toBe(6);
    const binding = workspace.components.find((binding) => binding.resultId === matrix.resultId)!;
    const declaration = components.find((component) => component.id === "heatmap")!;
    expect(chartPoints({ binding, result: matrix, declaration, act: () => {} })).toEqual(
      expect.arrayContaining([expect.objectContaining({ x: "Math", y: "North", value: 3 })]),
    );
    workspace = await ask("ranking");
    expect(
      app.engine.validateAction({ type: "drill", componentId: "ranking", label: "10" }, workspace)
        .request.filters,
    ).toEqual({ schoolId: 10 });
    workspace = await ask("drill", { type: "drill", componentId: "ranking", label: "10" });
    expect(
      workspace.results.find((result) => result.data.request.records)?.data.table?.rows,
    ).toHaveLength(4);
    workspace = await ask("back", { type: "back", componentId: "ranking" });
    workspace = await ask("completion");
    expect(
      workspace.results.find((result) => result.data.metric === "completion")?.data.value,
    ).toBe((4 / 6) * 100);
    workspace = await ask("projection");
    const projection = workspace.results.find(
      (result) => result.data.metric === "projectedEnrollment",
    )!;
    const projectedBinding = workspace.components.find(
      (binding) => binding.resultId === projection.resultId,
    )!;
    expect(() =>
      validateComposition(
        { components: [{ ...projectedBinding, properties: { title: "Projection" } }] },
        [projection],
        components,
      ),
    ).toThrow("scenario");
    workspace = await ask("passed", {
      type: "filter",
      componentId: "daily",
      field: "passed",
      value: false,
    });
    expect(
      workspace.results.find((result) => result.data.request.filters?.passed === false)?.data.value,
    ).toBe(2);
    await app.engine.close();
    await app.storage.close();
    app = await createWorkspace(configuration);
    expect(app.engine.snapshot().workspace).toEqual(workspace);
  } finally {
    await app.engine.close();
    await app.storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});
