import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { temporaryDatabasePath } from "../support/temp-path";

const databaseFiles: string[] = [];
let invalidEmbedding = false;
let embeddingCalls = 0;

afterEach(async () => {
  delete process.env.SUPPORT_KNOWLEDGE_RETRIEVAL;
  invalidEmbedding = false;
  embeddingCalls = 0;
  vi.doUnmock("@mastra/core/llm");
  await Promise.all(
    databaseFiles.splice(0).map((path) => rm(path, { force: true })),
  );
});

describe("support knowledge index", () => {
  it("publishes and searches an authoritative generation without model credentials", async () => {
    const databasePath = temporaryDatabasePath("phase001-rag");
    databaseFiles.push(
      databasePath,
      `${databasePath}-shm`,
      `${databasePath}-wal`,
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${databasePath}`;
    process.env.SUPPORT_KNOWLEDGE_RETRIEVAL = "vector";
    vi.resetModules();
    vi.doMock("@mastra/core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@mastra/core/llm")>();
      return {
        ...actual,
        ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {
          async doEmbed({ values }: { values: string[] }) {
            embeddingCalls += 1;
            return {
              embeddings: values.map(() =>
                invalidEmbedding ? [1] : [1, ...Array(1535).fill(0)],
              ),
              usage: { tokens: values.length },
            };
          }
        },
      };
    });

    const [
      { mastra },
      { searchSupportKnowledgeTool },
      { caseStore },
      { withTrustedCaseReadScope },
    ] = await Promise.all([
      import("../../src/mastra/index"),
      import("../../src/mastra/tools/search-support-knowledge"),
      import("../../src/mastra/lib/case-store"),
      import("../../src/mastra/lib/trusted-run-scope"),
    ]);
    const caseId = `knowledge-read-${crypto.randomUUID()}`;
    const readBinding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: "index-characterization",
    };
    await caseStore.acceptInbound(
      {
        id: caseId,
        externalId: `knowledge-event-${crypto.randomUUID()}`,
        source: "mock-email",
        status: "new",
        subject: "Knowledge read",
        customer: { email: "alex@example.com" },
        messages: [
          {
            id: `knowledge-message-${crypto.randomUUID()}`,
            author: "customer",
            authorName: "Alex",
            body: "Please find policy evidence.",
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          ownerId: "customer-alex",
          providerBinding: readBinding,
          providerBindings: {
            support: readBinding,
            commerce: readBinding,
            transactions: readBinding,
            knowledge: readBinding,
          },
        },
      },
      `knowledge-event-${crypto.randomUUID()}`,
      `knowledge-run-${crypto.randomUUID()}`,
    );
    const run = await mastra
      .getWorkflow("indexSupportKnowledgeWorkflow")
      .createRun();
    const indexed = await run.start({
      inputData: {
        binding: {
          tenantId: "local-demo",
          providerKind: "local",
          providerAccountId: "local-demo",
          externalConversationId: "index-characterization",
        },
        validation: { mode: "sandbox" },
      },
    });
    expect(indexed).toMatchObject({
      status: "success",
      result: { indexed: expect.any(Number) },
    });
    expect(
      indexed.status === "success" && indexed.result.indexed,
    ).toBeGreaterThan(0);
    await expect(
      searchSupportKnowledgeTool.execute({
        queryText: "duplicate charge refund policy",
        topK: 3,
        binding: readBinding,
      }),
    ).rejects.toThrow("verified workflow turn scope");
    const read = () =>
      withTrustedCaseReadScope(
        { caseId, ownerId: "customer-alex", tenantId: "local-demo" },
        () =>
          searchSupportKnowledgeTool.execute({
            queryText: "duplicate charge refund policy",
            topK: 3,
            binding: readBinding,
          }),
      );
    const results = await read();
    expect(results.sources).not.toHaveLength(0);
    await expect(
      withTrustedCaseReadScope(
        { caseId, ownerId: "customer-alex", tenantId: "local-demo" },
        () =>
          searchSupportKnowledgeTool.execute({
            queryText: "duplicate charge refund policy",
            topK: 1,
            binding: { ...readBinding, tenantId: "other-tenant" },
          }),
      ),
    ).rejects.toThrow("does not match the durable case");
    expect(results.sources[0]?.metadata).toMatchObject({
      source: expect.any(String),
      generationId: expect.any(String),
      documentHash: expect.any(String),
      effectiveAt: "2026-01-01T00:00:00.000Z",
      indexedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    const publishedGeneration = results.sources[0]!.metadata.generationId;
    const { searchPublishedVector, vectorStore } =
      await import("../../src/mastra/lib/vector-store");
    const { createValidationBudgetExecution } =
      await import("../../src/mastra/lib/eval-budget");
    const originalQuery = vectorStore.query.bind(vectorStore);
    let generatedMetadata: Record<string, unknown> | undefined;
    const query = vi
      .spyOn(vectorStore, "query")
      .mockImplementation(async (input) => {
        const rows = await originalQuery(input);
        generatedMetadata = rows[0]?.metadata as Record<string, unknown>;
        return rows;
      });
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
      ),
    ).resolves.toHaveLength(1);
    const validationQuery = createValidationBudgetExecution("sandbox");
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
        validationQuery,
      ),
    ).resolves.toHaveLength(1);
    expect(embeddingCalls).toBeGreaterThanOrEqual(3);
    expect(validationQuery.ledger.snapshot()).toMatchObject({
      reservedMicros: 0n,
    });
    const exhaustedQuery = createValidationBudgetExecution("sandbox");
    exhaustedQuery.ledger.reserve(9_999_999n);
    const callsBeforeExhaustion = embeddingCalls;
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
        exhaustedQuery,
      ),
    ).rejects.toThrow("budget exhausted");
    expect(embeddingCalls).toBe(callsBeforeExhaustion);
    expect(generatedMetadata).toMatchObject({
      chunkId: expect.any(String),
      chunkIndex: expect.any(Number),
      text: expect.any(String),
    });
    query.mockResolvedValue([
      {
        score: 1,
        metadata: {
          ...generatedMetadata,
          // Preserve the selected generation and hash while altering content
          // provenance: vector metadata is never serving authority.
          title: "Tampered policy title",
        },
      },
    ] as never);
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
      ),
    ).rejects.toThrow("does not match the publication");
    query.mockResolvedValue([
      {
        score: 1,
        metadata: { ...generatedMetadata, text: "" },
      },
    ] as never);
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
      ),
    ).rejects.toThrow("incomplete provenance");
    query.mockResolvedValue([
      {
        score: 1,
        metadata: {
          ...generatedMetadata,
          text: String(generatedMetadata?.text).slice(0, 12),
        },
      },
    ] as never);
    await expect(
      searchPublishedVector(
        readBinding,
        publishedGeneration,
        "duplicate charge refund policy",
        1,
      ),
    ).rejects.toThrow("does not match the publication");
    query.mockRestore();
    invalidEmbedding = true;
    const failed = await mastra
      .getWorkflow("indexSupportKnowledgeWorkflow")
      .createRun()
      .then((retry) =>
        retry.start({
          inputData: {
            binding: {
              tenantId: "local-demo",
              providerKind: "local",
              providerAccountId: "local-demo",
              externalConversationId: "index-characterization-retry",
            },
          },
        }),
      );
    expect(failed.status).toBe("failed");
    invalidEmbedding = false;
    const preserved = await withTrustedCaseReadScope(
      { caseId, ownerId: "customer-alex", tenantId: "local-demo" },
      () =>
        searchSupportKnowledgeTool.execute({
          queryText: "duplicate charge refund policy",
          topK: 1,
          binding: readBinding,
        }),
    );
    expect(preserved.sources[0]?.metadata.generationId).toBe(
      publishedGeneration,
    );
  });
});
