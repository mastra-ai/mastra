import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  reportHash,
  validateEvalReference,
} from "../../scripts/eval-baseline-record.mjs";
import {
  scoreAxis,
  scorerInputFromObservation,
  truthForDatasetCase,
} from "../eval/support/deterministic-semantics.js";
import {
  responseAgentScorers,
  scoreDraftResolutionFields,
  supportEvalScorerRegistry,
  triageAgentScorers,
} from "../eval/support/dataset-scorers";

function measuredReference() {
  return JSON.parse(
    readFileSync(
      new URL("../../evals/initial-reference.json", import.meta.url),
      "utf8",
    ),
  );
}
function rehash(record: Record<string, unknown>) {
  record.reportHash = reportHash(record);
  return record;
}
function rehashEvidence(record: {
  perCaseScores: Array<{
    evidence: { summary: unknown; evidenceHash: string };
  }>;
  evidenceHash: string;
}) {
  for (const item of record.perCaseScores)
    for (const call of (
      item.evidence.summary as {
        toolCalls?: Array<{ result: unknown; rawResultHash: string }>;
      }
    ).toolCalls ?? [])
      call.rawResultHash = createHash("sha256")
        .update(JSON.stringify(call.result))
        .digest("hex");
  for (const item of record.perCaseScores)
    item.evidence.evidenceHash = createHash("sha256")
      .update(JSON.stringify(item.evidence.summary))
      .digest("hex");
  record.evidenceHash = createHash("sha256")
    .update(JSON.stringify(record.perCaseScores))
    .digest("hex");
  return record;
}

function remeasuredCandidateReference() {
  const record = measuredReference();
  const replaceMeasurementAt = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(replaceMeasurementAt);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>))
      if (entry === "2026-01-01T00:00:02.000Z")
        (value as Record<string, unknown>)[key] = "2026-08-01T14:00:01.000Z";
      else replaceMeasurementAt(entry);
  };
  replaceMeasurementAt(record);
  return rehash(rehashEvidence(record));
}

type Summary = Record<string, unknown>;
type CaseScore = {
  id: string;
  axis: string;
  evidence: { summary: Summary };
};

function caseScore(record: Record<string, unknown>, id: string): CaseScore {
  const item = (record.perCaseScores as CaseScore[]).find(
    (candidate) => candidate.id === id,
  );
  if (!item) throw new Error(`Missing fixed dataset case ${id}`);
  return item;
}

function observation(summary: Summary) {
  const modelOutputs = summary.modelOutputs as Record<string, unknown>;
  return {
    triage: modelOutputs.triage,
    draft: modelOutputs.draft,
    calls: summary.toolCalls,
    workflow: summary.workflow,
    authorization: summary.authorization,
    financial: summary.financial,
    historyEstablished: summary.historyEstablished,
    refundEffects: summary.refundEffects,
    order: summary.order,
    answers: modelOutputs.answers,
    turns: modelOutputs.turns,
  };
}

function registeredScorer(axis: string) {
  const scorers = {
    groundedness: supportEvalScorerRegistry.groundedness,
    "policy-compliance": supportEvalScorerRegistry.policyCompliance,
    "routing-accuracy": supportEvalScorerRegistry.routingAccuracy,
    "tool-call-correctness": supportEvalScorerRegistry.toolCallCorrectness,
    "multi-turn-consistency": supportEvalScorerRegistry.multiTurnConsistency,
    "resolution-quality": supportEvalScorerRegistry.resolutionQuality,
  };
  const scorer = scorers[axis as keyof typeof scorers];
  if (!scorer) throw new Error(`Missing registered scorer for ${axis}`);
  return scorer;
}

function assertionsForCase(id: string) {
  for (const dataset of [
    "groundedness.v1.json",
    "multi-turn-consistency.v1.json",
    "policy-compliance.v1.json",
    "resolution-quality.v1.json",
    "routing-accuracy.v1.json",
    "tool-call-correctness.v1.json",
  ]) {
    const parsed = JSON.parse(
      readFileSync(new URL(`../../evals/datasets/${dataset}`, import.meta.url)),
    ) as { cases: Array<{ id: string; assertions: Record<string, unknown> }> };
    const found = parsed.cases.find((item) => item.id === id);
    if (found) return found.assertions;
  }
  throw new Error(`Missing versioned assertions for ${id}`);
}

function cloneAsRecordWithPrototype(value: unknown, prototype: object) {
  return Object.assign(Object.create(prototype), structuredClone(value));
}

describe("immutable eval reference records", () => {
  it("accepts the measured first reference without inventing a human approval", () => {
    expect(
      validateEvalReference(measuredReference(), { initial: true }),
    ).toMatchObject({ initialReference: true, historicalComparison: null });
  });

  it("rejects removed coverage, altered critical classifications, empty evidence, and fabricated aggregates", () => {
    const missing = measuredReference();
    missing.perCaseScores.pop();
    expect(() => validateEvalReference(rehash(missing))).toThrow("cover every");

    const critical = measuredReference();
    critical.perCaseScores.find(
      (item: { critical: boolean }) => item.critical,
    ).critical = false;
    expect(() => validateEvalReference(rehash(critical))).toThrow(
      "critical coverage",
    );

    const evidence = measuredReference();
    evidence.perCaseScores[0].evidence.summary = {};
    evidence.perCaseScores[0].evidence.evidenceHash = "0".repeat(64);
    expect(() => validateEvalReference(rehash(evidence))).toThrow(
      "invalid, duplicate, or unevidenced",
    );

    const aggregate = measuredReference();
    aggregate.sixAxisScores.groundedness = 0;
    expect(() => validateEvalReference(rehash(aggregate))).toThrow(
      "aggregates",
    );
  });

  it("rejects rehashed placeholder execution summaries and recomputed aggregate hashes", () => {
    const placeholder = measuredReference();
    for (const item of placeholder.perCaseScores) {
      item.evidence.summary = { placeholder: true };
      item.evidence.evidenceHash = "0".repeat(64);
    }
    placeholder.evidenceHash = "0".repeat(64);
    expect(() => validateEvalReference(rehash(placeholder))).toThrow(
      "invalid, duplicate, or unevidenced",
    );

    const aggregate = measuredReference();
    aggregate.evidenceHash = "0".repeat(64);
    expect(() => validateEvalReference(rehash(aggregate))).toThrow(
      "usage or execution evidence",
    );
  });

  it("rejects rehashed contradictory measurements, scorer identities, and assertion results", () => {
    const contradictory = measuredReference();
    contradictory.perCaseScores[0].evidence.summary.score = 0;
    expect(() =>
      validateEvalReference(rehash(rehashEvidence(contradictory))),
    ).toThrow("invalid, duplicate, or unevidenced");

    const wrongScorer = measuredReference();
    wrongScorer.perCaseScores[0].evidence.summary.scorerId = "wrong-scorer";
    expect(() =>
      validateEvalReference(rehash(rehashEvidence(wrongScorer))),
    ).toThrow("invalid, duplicate, or unevidenced");

    const failedAssertion = measuredReference();
    failedAssertion.perCaseScores[0].evidence.summary.assertions = {
      requiresCitation: false,
    };
    expect(() =>
      validateEvalReference(rehash(rehashEvidence(failedAssertion))),
    ).toThrow("invalid, duplicate, or unevidenced");
  });

  it("replays every declared assertion and scorer formula from rehashed observations", () => {
    const mutate = (
      id: string,
      apply: (summary: Record<string, unknown>) => void,
    ) => {
      const record = measuredReference();
      const item = record.perCaseScores.find(
        (caseScore: { id: string }) => caseScore.id === id,
      );
      if (!item) throw new Error(`Missing fixed dataset case ${id}`);
      apply(item.evidence.summary);
      expect(() =>
        validateEvalReference(rehash(rehashEvidence(record))),
      ).toThrow("invalid, duplicate, or unevidenced");
    };

    mutate("adversarial-routing", (summary) => {
      (
        summary.modelOutputs as { triage: { requiresHumanReview: boolean } }
      ).triage.requiresHumanReview = false;
    });
    mutate("lookup-before-refund", (summary) => {
      summary.caseId = "wrong-summary-case";
    });
    mutate("workflow-guard-mutation", (summary) => {
      const workflow = summary.workflow as {
        guarded: boolean;
        status: string;
      };
      workflow.guarded = false;
      workflow.status = "resolved";
      (
        summary.modelOutputs as { draft: { recommendRefund: boolean } }
      ).draft.recommendRefund = true;
    });
    for (const contradiction of [
      "Order ORD-1001 is fulfilled, but it was cancelled.",
      "Order ORD-1001 is fulfilled, but it is unfulfilled.",
      "Order ORD-1001 is fulfilled, but it is not fulfilled.",
      "Order ORD-1001 is fulfilled, but it is no longer fulfilled.",
      "Order ORD-1001 is fulfilled, but not fulfilled.",
      "Order ORD-1001 is fulfilled; actually its status is pending.",
      "It is false that Order ORD-1001 is fulfilled.",
      "Order ORD-1001 is fulfilled; it has never been fulfilled.",
    ])
      mutate("follow-up-stays-scoped", (summary) => {
        (
          summary.modelOutputs as { turns: Array<{ answer: string }> }
        ).turns[1].answer = contradiction;
      });
    for (const contradiction of [
      "Order ORD-1001 is fulfilled; actually its status is pending.",
      "It is false that Order ORD-1001 is fulfilled.",
      "Order ORD-1001 is fulfilled; it has never been fulfilled.",
    ])
      mutate("clear-resolution", (summary) => {
        (
          summary.modelOutputs as { draft: { draftResponse: string } }
        ).draft.draftResponse = contradiction;
      });
    mutate("follow-up-stays-scoped", (summary) => {
      (
        summary.modelOutputs as { turns: Array<{ turn: number }> }
      ).turns[1].turn = 1;
    });
    mutate("follow-up-stays-scoped", (summary) => {
      (summary.modelOutputs as { turns: Array<{ turn: number }> }).turns.pop();
    });
    mutate("follow-up-stays-scoped", (summary) => {
      const turns = (
        summary.modelOutputs as {
          turns: Array<{ turn: number; answer: string }>;
        }
      ).turns;
      turns.push(structuredClone(turns[0]));
    });
    mutate("no-financial-tool", (summary) => {
      (summary.toolCalls as Array<Record<string, unknown>>).push({
        sequence: 5,
        turn: 3,
        name: "issue_refund",
        input: {},
        result: {},
        rawResultHash: "0".repeat(64),
      });
    });
    const toolCalls = (summary: Record<string, unknown>) =>
      summary.toolCalls as Array<{
        input: Record<string, unknown>;
        result: Record<string, unknown>;
      }>;
    mutate("lookup-before-refund", (summary) => {
      toolCalls(summary)[2].input.queryText = "foreign policy";
    });
    mutate("lookup-before-refund", (summary) => {
      const sources = toolCalls(summary)[2].result.sources as Array<{
        metadata: Record<string, unknown>;
      }>;
      sources[0].metadata.documentHash = "0".repeat(64);
    });
    mutate("lookup-before-refund", (summary) => {
      toolCalls(summary)[3].input.customerEmail = "mallory@example.com";
    });
    mutate("lookup-before-refund", (summary) => {
      toolCalls(summary)[3].input.orderId = "ORD-9999";
    });
    mutate("lookup-before-refund", (summary) => {
      const order = toolCalls(summary)[3].result.order as Record<
        string,
        unknown
      >;
      order.customerEmail = "mallory@example.com";
    });
    mutate("lookup-before-refund", (summary) => {
      const order = toolCalls(summary)[3].result.order as Record<
        string,
        unknown
      >;
      order.status = "cancelled";
    });
    mutate("lookup-before-refund", (summary) => {
      toolCalls(summary)[2].result = { sources: [{}] };
    });
    mutate("lookup-before-refund", (summary) => {
      delete (toolCalls(summary)[3].result as { order?: unknown }).order;
    });
    mutate("lookup-before-refund", (summary) => {
      toolCalls(summary).pop();
    });
    mutate("lookup-before-refund", (summary) => {
      const calls = toolCalls(summary);
      calls.push(structuredClone(calls[0]));
    });
    mutate("lookup-before-refund", (summary) => {
      const calls = toolCalls(summary);
      calls[2] = structuredClone(calls[0]);
    });
    mutate("workflow-guard-mutation", (summary) => {
      (summary.workflow as { guarded: boolean }).guarded = false;
    });
    for (const id of [
      "unsupported-policy",
      "evidence-required",
      "insufficient-evidence",
    ]) {
      mutate(id, (summary) => {
        delete (summary.modelOutputs as { draft: { draftResponse?: string } })
          .draft.draftResponse;
      });
      mutate(id, (summary) => {
        (
          summary.modelOutputs as { draft: { draftResponse: unknown } }
        ).draft.draftResponse = 7;
      });
      mutate(id, (summary) => {
        (
          summary.modelOutputs as { draft: { draftResponse: string } }
        ).draft.draftResponse =
          "Your refund was issued. No support review is needed.";
      });
      mutate(id, (summary) => {
        (summary.workflow as { finalResponse: string }).finalResponse =
          "Your refund was issued. No support review is needed.";
      });
      mutate(id, (summary) => {
        (summary.workflow as { outboxBodies: string[] }).outboxBodies = [
          "Your refund was issued. No support review is needed.",
        ];
      });
    }
    for (const mutateBinding of [
      (calls: Array<{ input: Record<string, unknown> }>) => {
        calls[0].input.binding = { tenantId: "foreign" };
      },
      (calls: Array<{ input: Record<string, unknown> }>) => {
        calls[1].input.binding = {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "wrong-account",
          externalConversationId: "phase004-eval-conversation",
        };
      },
      (calls: Array<{ input: Record<string, unknown> }>) => {
        calls[2].input.binding = {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "wrong-account",
          externalConversationId: "phase004-eval-conversation",
        };
      },
      (calls: Array<{ input: Record<string, unknown> }>) => {
        calls[3].input.binding = {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "wrong-account",
          externalConversationId: "phase004-eval-conversation",
        };
      },
      (calls: Array<{ input: Record<string, unknown> }>) => {
        calls[2].input.untrusted = "extra";
      },
    ])
      mutate("lookup-before-refund", (summary) =>
        mutateBinding(toolCalls(summary)),
      );
    for (const mutateSource of [
      (sources: Array<Record<string, unknown>>) =>
        sources.push(structuredClone(sources[0])),
      (sources: Array<Record<string, unknown>>) =>
        sources.push({
          title: "Foreign policy",
          source: "foreign-policy",
          documentHash: "a".repeat(64),
        }),
      (sources: Array<Record<string, unknown>>) => {
        sources[0] = {};
      },
      (sources: Array<Record<string, unknown>>) => {
        sources[0].untrusted = "extra";
      },
    ])
      mutate("lookup-before-refund", (summary) =>
        mutateSource(
          toolCalls(summary)[2].result.sources as Array<
            Record<string, unknown>
          >,
        ),
      );
    const completeSource = (summary: Record<string, unknown>) =>
      (
        toolCalls(summary)[2].result.sources as Array<{
          document: string;
          metadata: Record<string, unknown>;
        }>
      )[0];
    const switchExactAuthority = (
      summary: Record<string, unknown>,
      index: 2 | 3,
    ) => {
      toolCalls(summary)[index].input.binding = {
        tenantId: "local-demo",
        providerKind: "local",
        providerAccountId: "phase004-eval-authority-lookup-before-refund-other",
        externalConversationId:
          "phase004-eval-conversation-lookup-before-refund-other",
      };
    };
    for (const apply of [
      (summary: Record<string, unknown>) => switchExactAuthority(summary, 2),
      (summary: Record<string, unknown>) => switchExactAuthority(summary, 3),
      (summary: Record<string, unknown>) => {
        completeSource(summary).document = "Refunds are unconditional.";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.text = "Refunds are unconditional.";
      },
      (summary: Record<string, unknown>) => {
        const entry = completeSource(summary);
        entry.document = "Attacker-controlled replacement.";
        entry.metadata.text = entry.document;
      },
      (summary: Record<string, unknown>) => {
        const entry = completeSource(summary);
        entry.document = "Attacker-controlled replacement.";
        entry.metadata.text = entry.document;
        entry.metadata.documentHash = createHash("sha256")
          .update(
            JSON.stringify([
              "duplicate-charge-policy",
              "local-v1",
              entry.document,
            ]),
          )
          .digest("hex");
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.version = "invented-v99";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.effectiveAt = "not-a-date";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.indexedAt = "2026-01-01T00:00:00Z";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.expiresAt = "2026-01-01T00:00:00.000Z";
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.providerAccountId = "foreign-account";
      },
      (summary: Record<string, unknown>) => {
        const documentHash = completeSource(summary).metadata.documentHash;
        toolCalls(summary)[2].result = {
          sources: [
            {
              title: "Duplicate Charge Policy",
              source: "duplicate-charge-policy",
              documentHash,
            },
          ],
        };
      },
      (summary: Record<string, unknown>) => {
        delete completeSource(summary).metadata.version;
      },
      (summary: Record<string, unknown>) => {
        completeSource(summary).metadata.untrusted = true;
      },
      (summary: Record<string, unknown>) => {
        const calls = toolCalls(summary);
        (calls[2].result.sources as Array<Record<string, unknown>>).push(
          structuredClone(completeSource(summary)),
        );
      },
    ])
      mutate("lookup-before-refund", apply);
    const sourceAt = (summary: Record<string, unknown>, index: 0 | 2) =>
      (
        toolCalls(summary)[index].result.sources as Array<{
          metadata: Record<string, unknown>;
        }>
      )[0].metadata;
    const orderAt = (summary: Record<string, unknown>, index: 1 | 3) =>
      toolCalls(summary)[index].result.order as Record<string, unknown>;
    // Every replay probe refreshes raw result, per-case evidence, aggregate
    // evidence, and report hashes through mutate(), proving semantic rather
    // than stale-hash rejection for the observed review-8 families.
    for (const apply of [
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 0).expiresAt = "2026-01-01T00:00:01.000Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 0).expiresAt = "2026-01-01T00:00:00.500Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 2).expiresAt = "2026-01-01T00:00:03.000Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 0).expiresAt = "2026-01-01T00:00:03.000Z";
        sourceAt(summary, 2).expiresAt = "2026-01-01T00:00:04.000Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 2).indexedAt = "2026-01-01T00:00:01.500Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 0).indexedAt = "2026-01-01T00:00:03.000Z";
        sourceAt(summary, 2).indexedAt = "2026-01-01T00:00:03.000Z";
      },
      (summary: Record<string, unknown>) => {
        sourceAt(summary, 0).generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
        sourceAt(summary, 2).generationId =
          "knowledge_11111111-1111-4111-8111-111111111111";
      },
    ])
      mutate("lookup-before-refund", apply);
    for (const [key, value] of [
      ["amount", 1],
      ["currency", "BTC"],
      ["product", "Tampered Plan"],
      ["chargeCount", 0],
      ["placedAt", "2026-08-02T14:00:00.000Z"],
    ] as const) {
      mutate("lookup-before-refund", (summary) => {
        orderAt(summary, 3)[key] = value;
      });
      mutate("lookup-before-refund", (summary) => {
        orderAt(summary, 1)[key] = value;
        orderAt(summary, 3)[key] = value;
      });
    }
    for (const apply of [
      (summary: Record<string, unknown>) => {
        delete orderAt(summary, 3).amount;
      },
      (summary: Record<string, unknown>) => {
        orderAt(summary, 3).untrusted = true;
      },
      (summary: Record<string, unknown>) => {
        delete (toolCalls(summary)[3].result as { found?: unknown }).found;
      },
    ])
      mutate("lookup-before-refund", apply);
  });

  it("requires plain nested records across registered, direct, and rehashed replay boundaries", async () => {
    const boundaryMutations = [
      {
        name: "binding",
        id: "lookup-before-refund",
        get: (summary: Summary) =>
          (summary.toolCalls as Array<{ input: Record<string, unknown> }>)[2]
            .input.binding,
        set: (summary: Summary, value: unknown) => {
          (
            summary.toolCalls as Array<{ input: Record<string, unknown> }>
          )[2].input.binding = value;
        },
      },
      {
        name: "knowledge result",
        id: "lookup-before-refund",
        get: (summary: Summary) =>
          (summary.toolCalls as Array<{ result: unknown }>)[2].result,
        set: (summary: Summary, value: unknown) => {
          (summary.toolCalls as Array<{ result: unknown }>)[2].result = value;
        },
      },
      {
        name: "metadata",
        id: "lookup-before-refund",
        get: (summary: Summary) =>
          (
            summary.toolCalls as Array<{
              result: { sources: Array<{ metadata: unknown }> };
            }>
          )[2].result.sources[0].metadata,
        set: (summary: Summary, value: unknown) => {
          (
            summary.toolCalls as Array<{
              result: { sources: Array<{ metadata: unknown }> };
            }>
          )[2].result.sources[0].metadata = value;
        },
      },
      {
        name: "lookup result",
        id: "lookup-before-refund",
        get: (summary: Summary) =>
          (summary.toolCalls as Array<{ result: unknown }>)[3].result,
        set: (summary: Summary, value: unknown) => {
          (summary.toolCalls as Array<{ result: unknown }>)[3].result = value;
        },
      },
      {
        name: "complete order",
        id: "lookup-before-refund",
        get: (summary: Summary) =>
          (
            summary.toolCalls as Array<{
              result: { order: unknown };
            }>
          )[3].result.order,
        set: (summary: Summary, value: unknown) => {
          (
            summary.toolCalls as Array<{
              result: { order: unknown };
            }>
          )[3].result.order = value;
        },
      },
      {
        name: "workflow",
        id: "workflow-guard-mutation",
        get: (summary: Summary) => summary.workflow,
        set: (summary: Summary, value: unknown) => {
          summary.workflow = value;
        },
      },
      {
        name: "financial",
        id: "approval-required",
        get: (summary: Summary) => summary.financial,
        set: (summary: Summary, value: unknown) => {
          summary.financial = value;
        },
      },
      {
        name: "authorization",
        id: "cross-tenant-denied",
        get: (summary: Summary) => summary.authorization,
        set: (summary: Summary, value: unknown) => {
          summary.authorization = value;
        },
      },
      {
        name: "refund effects",
        id: "lookup-before-refund",
        get: (summary: Summary) => summary.refundEffects,
        set: (summary: Summary, value: unknown) => {
          summary.refundEffects = value;
        },
      },
      {
        name: "triage",
        id: "adversarial-routing",
        get: (summary: Summary) =>
          (summary.modelOutputs as Record<string, unknown>).triage,
        set: (summary: Summary, value: unknown) => {
          (summary.modelOutputs as Record<string, unknown>).triage = value;
        },
      },
      {
        name: "draft",
        id: "grounded-policy",
        get: (summary: Summary) =>
          (summary.modelOutputs as Record<string, unknown>).draft,
        set: (summary: Summary, value: unknown) => {
          (summary.modelOutputs as Record<string, unknown>).draft = value;
        },
      },
      {
        name: "summary order",
        id: "clear-resolution",
        get: (summary: Summary) => summary.order,
        set: (summary: Summary, value: unknown) => {
          summary.order = value;
        },
      },
    ];

    const score = async (record: Record<string, unknown>, id: string) => {
      const item = caseScore(record, id);
      const assertions = assertionsForCase(id);
      const observed = observation(item.evidence.summary);
      const output = scorerInputFromObservation(item.axis, observed);
      const truth = truthForDatasetCase(item.axis, assertions, id);
      const direct = scoreAxis(item.axis, output, truth);
      const registered = await registeredScorer(item.axis).run({
        output,
        groundTruth: truth,
      });
      return { direct, registered: registered.score };
    };

    for (const boundary of boundaryMutations) {
      const record = remeasuredCandidateReference();
      expect(validateEvalReference(record, { initial: true })).toBe(record);
      const summary = caseScore(record, boundary.id).evidence.summary;
      boundary.set(summary, JSON.stringify(boundary.get(summary)));
      expect(await score(record, boundary.id), boundary.name).toEqual({
        direct: 0,
        registered: 0,
      });
      expect(() =>
        validateEvalReference(rehash(rehashEvidence(record))),
      ).toThrow("invalid, duplicate, or unevidenced");
    }

    for (const invalidValue of [[], 7, true, null]) {
      for (const boundary of boundaryMutations) {
        const record = remeasuredCandidateReference();
        const summary = caseScore(record, boundary.id).evidence.summary;
        boundary.set(summary, invalidValue);
        expect(
          await score(record, boundary.id),
          `${boundary.name} ${String(invalidValue)}`,
        ).toEqual({ direct: 0, registered: 0 });
        expect(() =>
          validateEvalReference(rehash(rehashEvidence(record))),
        ).toThrow("invalid, duplicate, or unevidenced");
      }
    }

    for (const prototype of [
      class EvidenceRecord {},
      { inherited: "not-json" },
    ]) {
      for (const boundary of boundaryMutations) {
        const record = remeasuredCandidateReference();
        const summary = caseScore(record, boundary.id).evidence.summary;
        boundary.set(
          summary,
          cloneAsRecordWithPrototype(boundary.get(summary), prototype),
        );
        expect(
          await score(record, boundary.id),
          `${boundary.name} prototype`,
        ).toEqual({
          direct: 0,
          registered: 0,
        });
        expect(() =>
          validateEvalReference(rehash(rehashEvidence(record))),
        ).toThrow("invalid, duplicate, or unevidenced");
      }
    }

    const futureOrder = remeasuredCandidateReference();
    const futureOrderSummary = caseScore(futureOrder, "lookup-before-refund")
      .evidence.summary;
    for (const index of [1, 3])
      (
        futureOrderSummary.toolCalls as Array<{
          result: { order: { placedAt: string } };
        }>
      )[index].result.order.placedAt = "2026-08-01T14:00:02.000Z";
    expect(await score(futureOrder, "lookup-before-refund")).toEqual({
      direct: 0,
      registered: 0,
    });
    expect(() =>
      validateEvalReference(rehash(rehashEvidence(futureOrder))),
    ).toThrow("invalid, duplicate, or unevidenced");
  });

  it("keeps JSON parsing only for the explicit top-level model-output contract", () => {
    expect(
      scoreDraftResolutionFields('{"draftResponse":"top-level model text"}'),
    ).toMatchObject({ hasDraftResponse: true });
  });

  it("fails closed for missing or malformed scorer evidence and truth", async () => {
    const record = measuredReference();
    const validPairs = (record.perCaseScores as CaseScore[]).map((item) => {
      return {
        axis: item.axis,
        output: scorerInputFromObservation(
          item.axis,
          observation(item.evidence.summary),
        ),
        truth: truthForDatasetCase(
          item.axis,
          assertionsForCase(item.id),
          item.id,
        ),
      };
    });
    expect(validPairs).toHaveLength(16);

    for (const { axis, output, truth } of validPairs) {
      const scorer = registeredScorer(axis);
      expect(scoreAxis(axis, output, truth), `${axis} direct`).toBe(1);
      await expect(
        scorer.run({ output, groundTruth: truth }),
        `${axis} registered`,
      ).resolves.toMatchObject({ score: 1 });
      await expect(
        scorer.run({ output: JSON.stringify(output), groundTruth: truth }),
        `${axis} registered top-level JSON`,
      ).resolves.toMatchObject({ score: 1 });
      expect(
        scoreAxis(axis, JSON.stringify(output), truth),
        `${axis} direct does not parse text`,
      ).toBe(0);
    }

    for (const { axis, output, truth } of validPairs) {
      const nonPlainOutput = cloneAsRecordWithPrototype(
        output,
        class OutputEvidence {},
      );
      const nonPlainTruth = cloneAsRecordWithPrototype(
        truth,
        class TruthEvidence {},
      );
      const invalidOutputs = [
        undefined,
        null,
        {},
        [],
        7,
        true,
        "{}",
        "{",
        nonPlainOutput,
      ];
      const invalidTruths = [
        undefined,
        null,
        {},
        [],
        7,
        true,
        "{}",
        "{",
        nonPlainTruth,
      ];
      const scorer = registeredScorer(axis);
      for (const invalidOutput of invalidOutputs) {
        expect(
          scoreAxis(axis, invalidOutput, truth),
          `${axis} direct invalid output`,
        ).toBe(0);
        await expect(
          scorer.run({ output: invalidOutput, groundTruth: truth }),
          `${axis} registered invalid output`,
        ).resolves.toMatchObject({ score: 0 });
      }
      for (const invalidTruth of invalidTruths) {
        expect(
          scoreAxis(axis, output, invalidTruth),
          `${axis} direct invalid truth`,
        ).toBe(0);
        await expect(
          scorer.run({ output, groundTruth: invalidTruth }),
          `${axis} registered invalid truth`,
        ).resolves.toMatchObject({ score: 0 });
      }
    }
  });

  it("does not approve operational policy or routing runs without ground truth", async () => {
    const record = measuredReference();
    const policy = caseScore(record, "approval-required");
    const routing = caseScore(record, "duplicate-charge");
    const policyOutput = scorerInputFromObservation(
      policy.axis,
      observation(policy.evidence.summary),
    );
    const routingOutput = scorerInputFromObservation(
      routing.axis,
      observation(routing.evidence.summary),
    );

    expect(responseAgentScorers.policyCompliance?.scorer).toBe(
      supportEvalScorerRegistry.policyCompliance,
    );
    expect(triageAgentScorers.routingAccuracy?.scorer).toBe(
      supportEvalScorerRegistry.routingAccuracy,
    );
    await expect(
      supportEvalScorerRegistry.policyCompliance.run({ output: policyOutput }),
    ).resolves.toMatchObject({ score: 0 });
    await expect(
      supportEvalScorerRegistry.routingAccuracy.run({ output: routingOutput }),
    ).resolves.toMatchObject({ score: 0 });
  });

  it("rejects every unsupported truth mode directly and through registered scorers", async () => {
    const record = measuredReference();
    const pairFor = (id: string) => {
      const item = caseScore(record, id);
      return {
        axis: item.axis,
        output: scorerInputFromObservation(
          item.axis,
          observation(item.evidence.summary),
        ),
        truth: truthForDatasetCase(item.axis, assertionsForCase(id), id),
      };
    };
    const rejects = async (
      id: string,
      label: string,
      mutate: (truth: Record<string, unknown>) => void,
    ) => {
      const pair = pairFor(id);
      const invalidTruth = structuredClone(pair.truth);
      mutate(invalidTruth);
      expect(scoreAxis(pair.axis, pair.output, invalidTruth), label).toBe(0);
      await expect(
        registeredScorer(pair.axis).run({
          output: pair.output,
          groundTruth: invalidTruth,
        }),
        label,
      ).resolves.toMatchObject({ score: 0 });
    };

    // These are the independently reproduced false-green combinations: each
    // adds a second mode that the old precedence logic ignored.
    await rejects(
      "approval-required",
      "policy contradictory modes",
      (truth) => {
        truth.unapprovedRefundDenied = true;
      },
    );
    await rejects(
      "lookup-before-refund",
      "tool-call contradictory modes",
      (truth) => {
        truth.forbiddenTool = "lookup_order";
      },
    );
    await rejects(
      "unsupported-policy",
      "groundedness contradictory modes",
      (truth) => {
        truth.requiresCitation = true;
      },
    );
    await rejects(
      "insufficient-evidence",
      "resolution contradictory modes",
      (truth) => {
        truth.customerFacing = true;
      },
    );
    await rejects(
      "follow-up-stays-scoped",
      "multi-turn contradictory modes",
      (truth) => {
        truth.tenantDenied = true;
      },
    );

    const matrix = [
      {
        id: "duplicate-charge",
        crossAxis: "requiresApproval",
        wrongType: "intent",
        conflicting: (truth: Record<string, unknown>) => {
          truth.requiresHumanReview = true;
        },
      },
      {
        id: "approval-required",
        crossAxis: "requiresCitation",
        wrongType: "requiresApproval",
        conflicting: (truth: Record<string, unknown>) => {
          truth.unapprovedRefundDenied = true;
        },
      },
      {
        id: "grounded-policy",
        crossAxis: "intent",
        wrongType: "requiresCitation",
        conflicting: (truth: Record<string, unknown>) => {
          truth.requiresEscalation = true;
        },
      },
      {
        id: "lookup-before-refund",
        crossAxis: "customerFacing",
        wrongType: "readOnlyToolsFirst",
        conflicting: (truth: Record<string, unknown>) => {
          truth.forbiddenTool = "lookup_order";
        },
      },
      {
        id: "follow-up-stays-scoped",
        crossAxis: "forbiddenTool",
        wrongType: "sameThread",
        conflicting: (truth: Record<string, unknown>) => {
          truth.tenantDenied = true;
        },
      },
      {
        id: "clear-resolution",
        crossAxis: "sameThread",
        wrongType: "customerFacing",
        conflicting: (truth: Record<string, unknown>) => {
          truth.requiresEscalation = true;
        },
      },
    ];
    for (const entry of matrix) {
      await rejects(entry.id, `${entry.id} unknown key`, (truth) => {
        truth.bogusAssertion = true;
      });
      await rejects(entry.id, `${entry.id} cross-axis assertion`, (truth) => {
        truth[entry.crossAxis] = true;
      });
      await rejects(entry.id, `${entry.id} wrong assertion type`, (truth) => {
        truth[entry.wrongType] = "true";
      });
      await rejects(entry.id, `${entry.id} partial contract`, (truth) => {
        delete truth.historyEstablished;
      });
      await rejects(
        entry.id,
        `${entry.id} conflicting mode`,
        entry.conflicting,
      );
    }
  });

  it("snapshots only canonical JSON output and truth before direct and registered scoring", async () => {
    const record = measuredReference();
    const pairFor = (id: string) => {
      const item = caseScore(record, id);
      return {
        axis: item.axis,
        output: scorerInputFromObservation(
          item.axis,
          observation(item.evidence.summary),
        ),
        truth: truthForDatasetCase(item.axis, assertionsForCase(id), id),
      };
    };
    const cases = [
      "duplicate-charge",
      "grounded-policy",
      "approval-required",
      "lookup-before-refund",
      "follow-up-stays-scoped",
      "clear-resolution",
    ];
    const variants = [
      {
        name: "non-enumerable",
        output: (value: Record<string, unknown>) => {
          value.audit = {};
          Object.defineProperty(value.audit, "bogus", {
            value: true,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        },
        truth: (value: Record<string, unknown>) => {
          Object.defineProperty(value.knowledgeEvidence, "bogus", {
            value: true,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        },
      },
      {
        name: "Symbol key",
        output: (value: Record<string, unknown>) => {
          value.audit = { [Symbol("untrusted")]: true };
        },
        truth: (value: Record<string, unknown>) => {
          (value.knowledgeEvidence as Record<symbol, unknown>)[
            Symbol("untrusted")
          ] = true;
        },
      },
      {
        name: "accessor",
        output: (value: Record<string, unknown>) => {
          value.audit = {};
          Object.defineProperty(value.audit, "bogus", {
            get: () => true,
            enumerable: true,
            configurable: true,
          });
        },
        truth: (value: Record<string, unknown>) => {
          Object.defineProperty(value.knowledgeEvidence, "title", {
            get: () => "Duplicate Charge Policy",
            enumerable: true,
            configurable: true,
          });
        },
      },
      {
        name: "exotic descriptor",
        output: (value: Record<string, unknown>) => {
          value.audit = {};
          Object.defineProperty(value.audit, "bogus", {
            value: true,
            enumerable: true,
            configurable: true,
            writable: false,
          });
        },
        truth: (value: Record<string, unknown>) => {
          const knowledge = value.knowledgeEvidence as Record<string, unknown>;
          Object.defineProperty(knowledge, "title", {
            value: knowledge.title,
            enumerable: true,
            configurable: true,
            writable: false,
          });
        },
      },
      {
        name: "Proxy",
        output: (value: Record<string, unknown>) => {
          value.audit = new Proxy({}, {});
        },
        truth: (value: Record<string, unknown>) => {
          value.knowledgeEvidence = new Proxy(
            value.knowledgeEvidence as Record<string, unknown>,
            {},
          );
        },
      },
      {
        name: "cycle",
        output: (value: Record<string, unknown>) => {
          const audit: Record<string, unknown> = {};
          audit.self = audit;
          value.audit = audit;
        },
        truth: (value: Record<string, unknown>) => {
          const knowledge = value.knowledgeEvidence as Record<string, unknown>;
          knowledge.self = knowledge;
        },
      },
      {
        name: "BigInt",
        output: (value: Record<string, unknown>) => {
          value.audit = { count: 1n };
        },
        truth: (value: Record<string, unknown>) => {
          (value.knowledgeEvidence as Record<string, unknown>).count = 1n;
        },
      },
      {
        name: "custom object prototype",
        output: (value: Record<string, unknown>) => {
          value.audit = Object.create({ inherited: true });
        },
        truth: (value: Record<string, unknown>) => {
          Object.setPrototypeOf(
            value.knowledgeEvidence as Record<string, unknown>,
            { inherited: true },
          );
        },
      },
      {
        name: "custom array prototype",
        output: (value: Record<string, unknown>) => {
          const audit: unknown[] = [];
          Object.setPrototypeOf(audit, { inherited: true });
          value.audit = audit;
        },
        truth: (value: Record<string, unknown>) => {
          const allowedSources = [...(value.allowedSources as string[])];
          Object.setPrototypeOf(allowedSources, { inherited: true });
          value.allowedSources = allowedSources;
        },
      },
    ];
    for (const id of cases)
      for (const variant of variants) {
        const pair = pairFor(id);
        const output = structuredClone(pair.output);
        variant.output(output);
        expect(
          scoreAxis(pair.axis, output, pair.truth),
          `${pair.axis}/${variant.name} nested output direct`,
        ).toBe(0);
        await expect(
          registeredScorer(pair.axis).run({
            output,
            groundTruth: pair.truth,
          }),
          `${pair.axis}/${variant.name} nested output registered`,
        ).resolves.toMatchObject({ score: 0 });

        const truth = structuredClone(pair.truth);
        variant.truth(truth);
        expect(
          scoreAxis(pair.axis, pair.output, truth),
          `${pair.axis}/${variant.name} nested truth direct`,
        ).toBe(0);
        await expect(
          registeredScorer(pair.axis).run({
            output: pair.output,
            groundTruth: truth,
          }),
          `${pair.axis}/${variant.name} nested truth registered`,
        ).resolves.toMatchObject({ score: 0 });
      }
  });

  it("rejects hostile top-level arrays and never invokes hostile evidence traps", async () => {
    const record = measuredReference();
    const pairFor = (id: string) => {
      const item = caseScore(record, id);
      return {
        axis: item.axis,
        output: scorerInputFromObservation(
          item.axis,
          observation(item.evidence.summary),
        ),
        truth: truthForDatasetCase(item.axis, assertionsForCase(id), id),
      };
    };
    const cases = [
      "duplicate-charge",
      "grounded-policy",
      "approval-required",
      "lookup-before-refund",
      "follow-up-stays-scoped",
      "clear-resolution",
    ];

    for (const id of cases) {
      const pair = pairFor(id);
      const hostileOutput: unknown[] = [];
      const hostileTruth: unknown[] = [];
      Object.setPrototypeOf(hostileOutput, { hostile: true });
      Object.setPrototypeOf(hostileTruth, { hostile: true });
      expect(scoreAxis(pair.axis, hostileOutput, pair.truth)).toBe(0);
      expect(scoreAxis(pair.axis, pair.output, hostileTruth)).toBe(0);
      await expect(
        registeredScorer(pair.axis).run({
          output: hostileOutput,
          groundTruth: pair.truth,
        }),
      ).resolves.toMatchObject({ score: 0 });
      await expect(
        registeredScorer(pair.axis).run({
          output: pair.output,
          groundTruth: hostileTruth,
        }),
      ).resolves.toMatchObject({ score: 0 });

      let getterReads = 0;
      const accessorOutput = structuredClone(pair.output);
      Object.defineProperty(accessorOutput, "hostile", {
        get: () => {
          getterReads += 1;
          return true;
        },
        enumerable: true,
        configurable: true,
      });
      let proxyReads = 0;
      const proxyTruth = new Proxy(pair.truth, {
        get: () => {
          proxyReads += 1;
          return undefined;
        },
      });
      await expect(
        registeredScorer(pair.axis).run({
          output: accessorOutput,
          groundTruth: proxyTruth,
        }),
      ).resolves.toMatchObject({ score: 0 });
      expect(getterReads, `${pair.axis} accessor read`).toBe(0);
      expect(proxyReads, `${pair.axis} proxy read`).toBe(0);
    }
  });

  it("snapshots observation adapters before selecting fields and admits only native undefined optionals", () => {
    const record = measuredReference();
    const item = caseScore(record, "grounded-policy");
    const validObservation = observation(item.evidence.summary);
    validObservation.financial = undefined;
    const truth = truthForDatasetCase(
      item.axis,
      assertionsForCase(item.id),
      item.id,
    );
    expect(
      scoreAxis(
        item.axis,
        scorerInputFromObservation(item.axis, validObservation),
        truth,
      ),
    ).toBe(1);

    const toolItem = caseScore(record, "lookup-before-refund");
    const optionalExpiry = observation(toolItem.evidence.summary);
    const searchCall = (
      optionalExpiry.calls as Array<{
        name: string;
        result: { sources: Array<{ metadata: Record<string, unknown> }> };
      }>
    ).find((call) => call.name === "search_support_knowledge");
    if (!searchCall) throw new Error("Missing fixture knowledge call");
    searchCall.result.sources[0].metadata.expiresAt = undefined;
    expect(
      scoreAxis(
        toolItem.axis,
        scorerInputFromObservation(toolItem.axis, optionalExpiry),
        truthForDatasetCase(
          toolItem.axis,
          assertionsForCase(toolItem.id),
          toolItem.id,
        ),
      ),
    ).toBe(1);

    const invalidUndefined = observation(item.evidence.summary);
    (invalidUndefined.draft as Record<string, unknown>).unrelated = undefined;
    expect(
      scoreAxis(
        item.axis,
        scorerInputFromObservation(item.axis, invalidUndefined),
        truth,
      ),
    ).toBe(0);

    let reads = 0;
    const hostileObservation = new Proxy(observation(item.evidence.summary), {
      get: () => {
        reads += 1;
        return undefined;
      },
    });
    expect(
      scoreAxis(
        item.axis,
        scorerInputFromObservation(item.axis, hostileObservation),
        truth,
      ),
    ).toBe(0);
    expect(reads).toBe(0);
  });

  it("permits expiresAt undefined only through native array index segments", async () => {
    const record = measuredReference();
    const cases = [
      "duplicate-charge",
      "grounded-policy",
      "approval-required",
      "lookup-before-refund",
      "follow-up-stays-scoped",
      "clear-resolution",
    ];
    const optionalSource = { metadata: { expiresAt: undefined } };
    const optionalCall = { result: { sources: [optionalSource] } };
    const variants: Array<{
      name: string;
      mutate: (value: Summary) => void;
    }> = [
      {
        name: "numeric record index",
        mutate: (value) => {
          value.toolCalls = { 0: optionalCall };
        },
      },
      {
        name: "leading-zero record indexes",
        mutate: (value) => {
          value.toolCalls = {
            "01": { result: { sources: { "00": optionalSource } } },
          };
        },
      },
      {
        name: "negative record index",
        mutate: (value) => {
          value.toolCalls = {
            "-1": { result: { sources: { 0: optionalSource } } },
          };
        },
      },
      {
        name: "fractional record index",
        mutate: (value) => {
          value.toolCalls = {
            "1.0": { result: { sources: { 0: optionalSource } } },
          };
        },
      },
      {
        name: "record sources below native calls array",
        mutate: (value) => {
          value.toolCalls = [{ result: { sources: { 0: optionalSource } } }];
        },
      },
      {
        name: "record calls above native sources array",
        mutate: (value) => {
          value.calls = {
            0: optionalCall,
          };
        },
      },
    ];

    for (const id of cases) {
      const item = caseScore(record, id);
      const truth = truthForDatasetCase(item.axis, assertionsForCase(id), id);
      const native = structuredClone(observation(item.evidence.summary));
      const calls = (native.calls as Array<Record<string, unknown>>) ?? [];
      const search = calls.find(
        (call) => call.name === "search_support_knowledge",
      );
      if (search) {
        const sources = (
          search.result as {
            sources: Array<{ metadata: Record<string, unknown> }>;
          }
        ).sources;
        sources[0].metadata.expiresAt = undefined;
      } else {
        calls.push({
          name: "search_support_knowledge",
          result: { sources: [{ metadata: { expiresAt: undefined } }] },
        });
      }
      native.calls = calls;
      const nativeOutput = scorerInputFromObservation(item.axis, native);
      expect(
        scoreAxis(item.axis, nativeOutput, truth),
        `${item.axis} native`,
      ).toBe(1);
      await expect(
        registeredScorer(item.axis).run({
          output: nativeOutput,
          groundTruth: truth,
        }),
      ).resolves.toMatchObject({ score: 1 });

      for (const variant of variants) {
        const malformed = structuredClone(observation(item.evidence.summary));
        variant.mutate(malformed);
        const output = scorerInputFromObservation(item.axis, malformed);
        expect(
          scoreAxis(item.axis, output, truth),
          `${item.axis}/${variant.name} direct`,
        ).toBe(0);
        await expect(
          registeredScorer(item.axis).run({ output, groundTruth: truth }),
          `${item.axis}/${variant.name} registered`,
        ).resolves.toMatchObject({ score: 0 });
      }
    }
  });

  it("keeps factory authorities isolated after a contaminated trajectory", async () => {
    const record = measuredReference();
    const item = caseScore(record, "lookup-before-refund");
    const output = scorerInputFromObservation(
      item.axis,
      observation(item.evidence.summary),
    );
    const first = truthForDatasetCase(
      item.axis,
      assertionsForCase(item.id),
      item.id,
    );
    first.expectedCallOrder.reverse();
    first.knowledgeEvidence.title = "Tampered title";
    const second = truthForDatasetCase(
      item.axis,
      assertionsForCase(item.id),
      item.id,
    );
    expect(second.expectedCallOrder).toEqual([
      "search_support_knowledge",
      "lookup_order",
      "search_support_knowledge",
      "lookup_order",
    ]);
    expect(second.knowledgeEvidence.title).toBe("Duplicate Charge Policy");
    expect(second.expectedCallOrder).not.toBe(first.expectedCallOrder);
    expect(second.knowledgeEvidence).not.toBe(first.knowledgeEvidence);

    const contaminatedOutput = structuredClone(output);
    contaminatedOutput.toolCalls.reverse();
    for (const call of contaminatedOutput.toolCalls)
      if (call.name === "search_support_knowledge")
        call.result.sources[0].metadata.title = "Tampered title";
    expect(scoreAxis(item.axis, contaminatedOutput, second)).toBe(0);
    await expect(
      registeredScorer(item.axis).run({
        output: contaminatedOutput,
        groundTruth: second,
      }),
    ).resolves.toMatchObject({ score: 0 });

    const later = truthForDatasetCase(
      item.axis,
      assertionsForCase(item.id),
      item.id,
    );
    expect(scoreAxis(item.axis, output, later)).toBe(1);
    await expect(
      registeredScorer(item.axis).run({ output, groundTruth: later }),
    ).resolves.toMatchObject({ score: 1 });
  });
});
