import {
  benchmarkBudget,
  BenchmarkModel,
  benchmarkCorpus,
  runBenchmark,
} from "../../scripts/quality/benchmark.ts";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { expectEvals, EvalPassRateError } from "@mastra/evals/vitest";
import { SalesSource } from "../../data-sources/sales/source.ts";
import { DataExplorer } from "../../src/analysis/explorer.ts";
import { qualityReport, dimensions } from "../../scripts/quality/evaluation.ts";
import type { QualityCase, Observation } from "../../scripts/quality/evaluation.ts";
import { LocalTelemetry } from "../../src/observability/telemetry.ts";
import { WorkspaceEngine } from "../../src/workspace/engine.ts";
import { WorkspaceStore } from "../../src/workspace/store.ts";
import { workspaceId, threadId } from "../../src/workspace/contracts.ts";
import { components, validateComposition } from "../../src/ui/catalog.ts";
import { referenceFixture } from "../fixtures/reference.ts";
import { workspaceModel } from "../fixtures/workspace-model.ts";
import { analysisModel } from "../fixtures/analysis-model.ts";
import { qualityCases, evaluationTarget } from "../fixtures/quality.ts";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function scratch() {
  const directory = await mkdtemp(join(tmpdir(), "quality-proof-"));
  directories.push(directory);
  return directory;
}
async function observe(item: QualityCase): Promise<Observation> {
  const directory = await scratch();
  const fixture = referenceFixture(join(directory, "sales.sqlite"));
  fixture.db.close();
  const provider = workspaceModel({
    ...(item.plan ? { plan: item.plan } : {}),
    ...(item.expected.component ? { component: item.expected.component } : {}),
    properties: {
      title: "Independent expected view",
      ...(item.expected.x ? { x: item.expected.x, y: "value" } : {}),
      ...(item.expected.scenario ? { scenario: true } : {}),
    },
  });
  const explorer = new DataExplorer(
    new SalesSource(join(directory, "sales.sqlite")),
    provider.model,
    { catalog: components },
  );
  let bindings: Observation["components"] = [];
  try {
    const outcome = await explorer.analyze(
      {
        requestId: item.id,
        workspaceId: "quality",
        threadId: "quality",
        baseRevision: 0,
        question: item.question,
      },
      {
        onComplete: (session) => {
          bindings = session.composition?.components ?? [];
        },
      },
    );
    return { case: item, outcome, components: bindings, source: explorer.describe() };
  } finally {
    await explorer.close();
  }
}
it("eight_dimension_eval_report_detects_regressions", async () => {
  const observations: Observation[] = [];
  for (const item of qualityCases) observations.push(await observe(item));
  const report = qualityReport(observations, {
    model: "deterministic-workspace-proof",
    corpusVersion: "independent-facts-v1",
    mode: "deterministic",
    budget: { paidCalls: 0 },
  });
  expect(report.summary.map((item) => item.dimension)).toEqual(dimensions);
  expect(report.summary.every((item) => item.applicable > 0)).toBe(true);
  expect(report.passed, JSON.stringify(report.summary)).toBe(true);
  const broken = evaluationTarget(observe, true);
  await expect(
    expectEvals({
      target: broken.target,
      gates: [broken.gate],
      data: [{ input: { caseId: "joined-bookings" } }],
    }).toPass(),
  ).rejects.toBeInstanceOf(EvalPassRateError);
  const { target, gate } = evaluationTarget(observe);
  const official = await expectEvals({
    target,
    gates: [gate],
    data: qualityCases.map((item) => ({ input: { caseId: item.id } })),
    concurrency: 1,
  }).toPass();
  expect(official.summary.totalItems).toBe(8);
  expect(official.verdict).toBe("passed");
  const result = observations[0]!.outcome.results[0]!;
  expect(() =>
    validateComposition(
      {
        components: [
          {
            id: "misleading",
            component: "line",
            version: "1",
            resultId: result.resultId,
            properties: { title: "Bad axes", x: "value", y: "month" },
          },
        ],
      },
      [result],
      components,
    ),
  ).toThrow();
  const forecast = observations.find((item) => item.case.id === "forecast")!;
  expect(() =>
    validateComposition(
      {
        components: [
          { ...forecast.components[0]!, properties: { title: "Guaranteed future revenue" } },
        ],
      },
      forecast.outcome.results,
      components,
    ),
  ).toThrow();
  result.data.value = 999999;
  expect(
    qualityReport(observations, {
      model: "deterministic",
      corpusVersion: "regression",
      mode: "deterministic",
    }).passed,
  ).toBe(false);
  await mkdir(".data", { recursive: true });
  await writeFile(".data/quality-report.json", JSON.stringify(report, null, 2));
});
it("telemetry_reports_domain_outcomes_without_secrets", async () => {
  const directory = await scratch();
  const fixture = referenceFixture(join(directory, "sales.sqlite"));
  fixture.db.close();
  const telemetry = new LocalTelemetry(join(directory, "telemetry.sqlite"));
  const provider = workspaceModel({ schemaDriven: true });
  const explorer = new DataExplorer(
    new SalesSource(join(directory, "sales.sqlite")),
    provider.model,
    { catalog: components, telemetry },
  );
  const engine = new WorkspaceEngine(
    explorer,
    new WorkspaceStore(join(directory, "workspace.sqlite")),
    components,
  );
  const question = (requestId: string, text = "Show monthly bookings") => ({
    requestId,
    workspaceId,
    threadId,
    baseRevision: engine.snapshot().workspace.revision,
    question: text,
  });
  const execute = async (
    context: import("@mastra/core/request-context").RequestContext,
    session: import("../../src/analysis/workflow.ts").Session,
  ) => explorer.agent.generate(session.question.question, { requestContext: context });
  try {
    const first = await engine.run(question("first"), new AbortController(), execute);
    expect(first.snapshot.workspace.revision).toBe(1);
    expect(provider.calls).toHaveLength(3);
    expect(telemetry.report().usage.filter((event) => event.requestId === "first")).toEqual([
      {
        requestId: "first",
        model: "workspace-proof",
        inputTokens: provider.calls.length * 10,
        outputTokens: provider.calls.length * 10,
        estimatedCost: null,
        pricingVersion: null,
        currency: null,
      },
    ]);
    const view = first.snapshot.workspace.components[0]!;
    const ack = { revision: 1, componentId: view.id, resultId: view.resultId };
    engine.acknowledgeRender(ack);
    engine.acknowledgeRender(ack);
    expect(() => engine.acknowledgeRender({ ...ack, resultId: "forged" })).toThrow();
    await engine.run(question("corrected"), new AbortController(), execute, undefined, undefined, {
      componentId: view.id,
      reason: "Use the current verified monthly representation.",
    });
    expect(engine.snapshot().workspace.corrections?.length).toBe(1);
    await engine.run(
      question("unsupported", "Why did Sales fall?"),
      new AbortController(),
      execute,
    );
    await engine.run(
      question("rejected", "DELETE FROM opportunities"),
      new AbortController(),
      execute,
    );
    const outage = analysisModel([], { fail: true });
    await explorer.analyze(
      { ...question("outage"), workspaceId: "outage" },
      {
        execute: (context) =>
          explorer.agent.generate("What are bookings?", {
            requestContext: context,
            model: outage.model,
          }),
      },
    );
    await expect(
      engine.run(
        question("invalid-correction"),
        new AbortController(),
        execute,
        undefined,
        undefined,
        { componentId: "missing", reason: "Correct the prior view." },
      ),
    ).rejects.toThrow(/accepted view/);
    const failedCorrection = await engine.run(
      question("failed-correction"),
      new AbortController(),
      (context, session) =>
        explorer.agent.generate(session.question.question, {
          requestContext: context,
          model: outage.model,
        }),
      undefined,
      undefined,
      { componentId: view.id, reason: "Replace the accepted view after verification." },
    );
    expect(failedCorrection.outcome).toMatchObject({ status: "failed" });
    expect(engine.snapshot().workspace.revision).toBe(2);
    expect(engine.snapshot().workspace.corrections).toHaveLength(1);
    telemetry.record({
      type: "provider-usage",
      requestId: "unavailable",
      workspaceId,
      model: "unknown",
    });
    telemetry.record({
      type: "guardrail",
      requestId: "secret-marker",
      workspaceId,
      operation: "credential=synthetic-secret-marker sk-synthetic-secret",
    });
    const events = telemetry.events();
    expect(events.filter((event) => event.type === "render-ack")).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("synthetic-secret");
    expect(JSON.stringify(events)).not.toContain("Use the current verified");
    const report = telemetry.report();
    expect(report.querySuccess).toEqual({ numerator: 2, denominator: 2, rate: 1 });
    expect(report.followupRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(report.correctionRate).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(report.unsupported).toBe(1);
    expect(report.validationRejects).toBe(1);
    expect(report.visualizationUsage.line).toBe(2);
    expect(
      report.timeToFirstInsight.find((item) => item.requestId === "first")?.elapsedMs,
    ).toBeTypeOf("number");
    expect(
      report.timeToFirstInsight.find((item) => item.requestId === "corrected")?.elapsedMs,
    ).toBeNull();
    expect(report.usage.find((item) => item.requestId === "unavailable")).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
    });
    expect(
      events.some(
        (event) =>
          event.type === "calculation-verified" && event.queryId && event.traceId && event.resultId,
      ),
    ).toBe(true);
    telemetry.close();
    const restored = new LocalTelemetry(join(directory, "telemetry.sqlite"));
    expect(restored.report()).toEqual(report);
    restored.close();
    const warning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
    try {
      await engine.run(question("diagnostics-unavailable"), new AbortController(), execute);
      expect(engine.snapshot().workspace.revision).toBe(3);
      expect(warning).toHaveBeenCalledTimes(1);
    } finally {
      warning.mockRestore();
    }
  } finally {
    await engine.close();
  }
});

it("live_benchmark_protocol_is_bounded_separate_and_not_retried", async () => {
  const directory = await scratch();
  const fixture = referenceFixture(join(directory, "sales.sqlite"));
  fixture.db.close();
  const source = new SalesSource(join(directory, "sales.sqlite"));
  const options = {
    approved: true as const,
    capUsd: 100,
    inputUsdPerMillion: 0.4,
    outputUsdPerMillion: 1.6,
    pricingVersion: "synthetic-protocol-pricing",
    pricingModel: "deterministic",
    pricingVerifiedAt: new Date().toISOString().slice(0, 10),
    pricingReference: "https://openai.com/api/pricing/",
    model: "deterministic",
    maxInputBytes: 65536,
  };
  try {
    expect(() => benchmarkBudget({ ...options, approved: false })).toThrow();
    expect(() => benchmarkBudget({ ...options, inputUsdPerMillion: 0 })).toThrow();
    expect(() => benchmarkBudget({ ...options, pricingModel: "unpriced" })).toThrow(/exact model/);
    expect(() => benchmarkBudget({ ...options, pricingVerifiedAt: "2020-01-01" })).toThrow(
      /seven days/,
    );
    expect(() => benchmarkBudget({ ...options, capUsd: 0.001 })).toThrow(/upper bound/);
    const budget = benchmarkBudget(options);
    expect(budget.concurrency).toBe(1);
    expect(budget.paidRetries).toBe(0);
    expect(budget.calls).toBe(192);
    const bounded = new BenchmarkModel({ providerId: "openai", modelId: "gpt-4.1-mini" }, budget);
    expect(() =>
      bounded.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "x".repeat(65537) }] }],
        maxOutputTokens: 1024,
      }),
    ).toThrow(/envelope/);
    expect(bounded.calls).toBe(0);
    const cases = await benchmarkCorpus(source);
    expect(cases).toHaveLength(24);
    expect(new Set(cases.flatMap((item) => (item.pair ? [item.pair] : []))).size).toBe(4);
    const provider = workspaceModel({
      choose: (question) => {
        const item = cases.find((item) => item.question === question);
        if (!item) throw new Error("Unknown corpus question.");
        return {
          ...(item.plan ? { plan: item.plan } : {}),
          ...(item.expected.component ? { component: item.expected.component } : {}),
          ...(item.expected.scenario ? { scenario: true } : {}),
        };
      },
    });
    const report = await runBenchmark(source, provider.model, options);
    expect(report.totalCases).toBe(24);
    expect(report.skipped).toEqual([]);
    expect(report.mode).toBe("live");
    expect(report.passed, JSON.stringify(report.summary)).toBe(true);
    expect(report.summary.every((item) => item.applicable > 0)).toBe(true);
    const failing = analysisModel([], { fail: true });
    const failure = await runBenchmark(source, failing.model, options);
    expect(failure.passed).toBe(false);
    expect(failure.totalCases).toBe(1);
    expect(failure.skipped).toHaveLength(23);
    expect(failing.calls).toHaveLength(1);
  } finally {
    await source.close();
  }
});
