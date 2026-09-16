import { describe, expect, it, vi } from "vitest";
import {
  EvalBudgetLedger,
  budgetedEmbedding,
  budgetedLanguageModel,
  createValidationBudgetExecution,
  withReservedModelBudget,
} from "../../src/mastra/lib/eval-budget";

describe("eval budget ledger", () => {
  it("reserves before a call, reconciles actual usage, and fails closed at the exact limit", () => {
    const budget = new EvalBudgetLedger("ci-eval");
    const reservation = budget.reserve(4_999_999n);
    expect(() => budget.reserve(1n)).toThrow("budget exhausted");
    budget.reconcile(reservation, 4_999_999n);
    expect(budget.snapshot()).toMatchObject({
      actualMicros: 4_999_999n,
      reservedMicros: 0n,
    });
    expect(() => budget.reserve(1n)).toThrow("budget exhausted");
    expect(() => budget.reconcile(reservation, 1n)).toThrow("Unknown, foreign");
    expect(() => budget.reserve(0n)).toThrow("unknown or invalid");
    const other = new EvalBudgetLedger("ci-eval").reserve(1n);
    expect(() => budget.reconcile(other, -1n)).toThrow("Unknown, foreign");
  });

  it("rejects a copied foreign reservation and reserves before optional billable work", async () => {
    const first = new EvalBudgetLedger("sandbox");
    const reservation = first.reserve(1n);
    const foreign = new EvalBudgetLedger("sandbox");
    expect(() => foreign.reconcile(reservation, 1n)).toThrow(
      "Unknown, foreign",
    );
    let invoked = false;
    await expect(
      withReservedModelBudget({
        execution: createValidationBudgetExecution("sandbox"),
        estimatedMicrosUsd: 10_000_001n,
        execute: async () => {
          invoked = true;
          return { value: "should-not-run", actualMicrosUsd: 1n };
        },
      }),
    ).rejects.toThrow("budget exhausted");
    expect(invoked).toBe(false);
  });

  it("prevents concurrent callers from reaching the DEC-016 limit before either transport runs", async () => {
    const budget = new EvalBudgetLedger("ci-eval");
    let calls = 0;
    const attempt = async () => {
      const reservation = budget.reserve(2_500_000n);
      calls += 1;
      budget.reconcile(reservation, 2_500_000n);
    };
    await expect(Promise.all([attempt(), attempt()])).rejects.toThrow(
      "budget exhausted",
    );
    expect(calls).toBe(1);
  });

  it("runs a known deterministic model through one validation ledger and blocks unknown prices before transport", async () => {
    const execute = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "validated" }],
      finishReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    const model = {
      specificationVersion: "v2" as const,
      provider: "phase004-test",
      modelId: "deterministic",
      supportedUrls: {},
      doGenerate: execute,
      async doStream() {
        throw new Error("not used");
      },
    };
    const execution = createValidationBudgetExecution("ci-eval");
    await expect(
      budgetedLanguageModel(model, execution).doGenerate({ prompt: [] }),
    ).resolves.toMatchObject({ content: [{ text: "validated" }] });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execution.ledger.snapshot()).toMatchObject({
      actualMicros: 0n,
      reservedMicros: 0n,
    });

    const unpricedTransport = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "must-not-run" }],
      finishReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    await expect(
      budgetedLanguageModel(
        { ...model, provider: "unpriced", doGenerate: unpricedTransport },
        createValidationBudgetExecution("ci-eval"),
      ).doGenerate({ prompt: [] }),
    ).rejects.toThrow("unknown model price");
    expect(unpricedTransport).not.toHaveBeenCalled();
  });

  it("atomically blocks exhausted concurrent model and embedding transports before either request", async () => {
    const execution = createValidationBudgetExecution("ci-eval");
    execution.ledger.reserve(4_999_998n);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generate = vi.fn(async () => {
      await gate;
      return {
        content: [{ type: "text" as const, text: "done" }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    });
    const model = {
      specificationVersion: "v2" as const,
      provider: "phase004-test",
      modelId: "deterministic",
      supportedUrls: {},
      doGenerate: generate,
      async doStream() {
        throw new Error("not used");
      },
    };
    const guarded = budgetedLanguageModel(model, execution);
    const first = guarded.doGenerate({ prompt: [] });
    await expect(guarded.doGenerate({ prompt: [] })).rejects.toThrow(
      "budget exhausted",
    );
    expect(generate).toHaveBeenCalledTimes(1);
    release();
    await first;

    const embeddingExecution = createValidationBudgetExecution("sandbox");
    embeddingExecution.ledger.reserve(9_999_999n);
    const embed = vi.fn(async () => ({
      embeddings: [[1, 0]],
      usage: { tokens: 1 },
    }));
    await expect(
      budgetedEmbedding({
        execution: embeddingExecution,
        model: "openai/text-embedding-3-small",
        values: ["policy"],
        execute: embed,
      }),
    ).rejects.toThrow("budget exhausted");
    expect(embed).not.toHaveBeenCalled();
  });

  it("fails closed when a transport cannot report validated usage", async () => {
    const embed = vi.fn(async () => ({ embeddings: [[1, 0]] }));
    await expect(
      budgetedEmbedding({
        execution: createValidationBudgetExecution("ci-eval"),
        model: "openai/text-embedding-3-small",
        values: ["policy"],
        execute: embed,
      }),
    ).rejects.toThrow("unknown or invalid actual usage");
    expect(embed).toHaveBeenCalledTimes(1);
  });
});
