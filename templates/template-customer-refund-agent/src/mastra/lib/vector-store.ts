import { LibSQLVector } from "@mastra/libsql";
import { resolveDatabaseUrl } from "./database-url";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { MDocument } from "@mastra/rag";
import type {
  KnowledgeEvidence,
  ProviderBinding,
} from "../providers/contracts";
import type { PublishedEvidence } from "./knowledge-publications";
import { knowledgePublicationStore } from "./knowledge-publications";
import { createHash } from "node:crypto";
import {
  budgetedEmbedding,
  type ValidationBudgetExecution,
} from "./eval-budget";

function resolveLibsqlConfig() {
  return {
    url: resolveDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  };
}

export const vectorStore = new LibSQLVector({
  id: "support-vectors",
  ...resolveLibsqlConfig(),
});

export const KNOWLEDGE_INDEX = "support_knowledge";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

const indexNameForGeneration = (generationId: string) =>
  `${KNOWLEDGE_INDEX}_${createHash("sha256")
    .update(generationId)
    .digest("hex")
    .slice(0, 32)}`;

function chunkId(documentHash: string, chunkIndex: number, text: string) {
  return createHash("sha256")
    .update(JSON.stringify([documentHash, chunkIndex, text]))
    .digest("hex");
}

async function authoritativeChunks(document: PublishedEvidence) {
  const mdoc = MDocument.fromText(document.text, {
    title: document.title,
    source: document.source,
  });
  return (
    await mdoc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    })
  ).map((piece, chunkIndex) => ({
    chunkIndex,
    text: String(piece.text),
    chunkId: chunkId(document.documentHash, chunkIndex, String(piece.text)),
  }));
}

/** Builds an isolated physical index. Callers publish the matching SQL
 * generation only after this succeeds, preserving the previous serving pair. */
export async function buildPublishedVectorCandidate(
  binding: ProviderBinding,
  generationId: string,
  documents: KnowledgeEvidence[],
  validationExecution?: ValidationBudgetExecution,
) {
  const indexName = indexNameForGeneration(generationId);
  await vectorStore.createIndex({
    indexName,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
  });
  const chunks: Array<{ text: string; metadata: Record<string, unknown> }> = [];
  for (const document of documents) {
    if (!document.effectiveAt)
      throw new Error(
        "Knowledge vector candidate lacks source effective time.",
      );
    const documentHash = createHash("sha256")
      .update(
        JSON.stringify([document.source, document.version, document.text]),
      )
      .digest("hex");
    const authoritative = await knowledgePublicationStore.document(
      binding,
      generationId,
      document.source,
      documentHash,
    );
    if (!authoritative)
      throw new Error(
        "Knowledge vector candidate lacks publication authority.",
      );
    const mdoc = MDocument.fromText(document.text, {
      title: document.title,
      source: document.source,
    });
    const pieces = await mdoc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    });
    for (const [chunkIndex, piece] of pieces.entries())
      chunks.push({
        text: String(piece.text),
        metadata: {
          title: authoritative.title,
          source: authoritative.source,
          text: String(piece.text),
          version: authoritative.version,
          documentHash: authoritative.documentHash,
          generationId,
          effectiveAt: authoritative.effectiveAt,
          indexedAt: authoritative.indexedAt,
          expiresAt: authoritative.expiresAt,
          chunkIndex,
          chunkId: chunkId(
            authoritative.documentHash,
            chunkIndex,
            String(piece.text),
          ),
          tenantId: binding.tenantId,
          providerKind: binding.providerKind,
          providerAccountId: binding.providerAccountId,
        },
      });
  }
  if (chunks.length === 0)
    throw new Error("Knowledge vector candidate has no chunks.");
  const model = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  const { embeddings } = await budgetedEmbedding({
    execution: validationExecution,
    model: EMBEDDING_MODEL,
    values: chunks.map((chunk) => chunk.text),
    execute: () =>
      model.doEmbed({
        values: chunks.map((chunk) => chunk.text),
      }),
  });
  if (
    embeddings.length !== chunks.length ||
    embeddings.some(
      (embedding) =>
        embedding.length !== EMBEDDING_DIMENSION ||
        embedding.some((value) => !Number.isFinite(value)),
    )
  )
    throw new Error(
      "Knowledge vector candidate has invalid embedding dimensions.",
    );
  await vectorStore.upsert({
    indexName,
    vectors: embeddings,
    metadata: chunks.map((chunk) => chunk.metadata),
  });
}

/** Vector retrieval is optional at runtime, but always reads the SQL-selected
 * generation. It cannot inspect a candidate or an orphaned old index. */
export async function searchPublishedVector(
  binding: ProviderBinding,
  generationId: string,
  query: string,
  topK: number,
  validationExecution?: ValidationBudgetExecution,
): Promise<PublishedEvidence[]> {
  const model = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  const { embeddings } = await budgetedEmbedding({
    execution: validationExecution,
    model: EMBEDDING_MODEL,
    values: [query],
    execute: () => model.doEmbed({ values: [query] }),
  });
  if (
    embeddings.length !== 1 ||
    embeddings[0]?.length !== EMBEDDING_DIMENSION ||
    embeddings[0].some((value) => !Number.isFinite(value))
  )
    throw new Error("Knowledge vector query has invalid embedding dimensions.");
  const rows = await vectorStore.query({
    indexName: indexNameForGeneration(generationId),
    queryVector: embeddings[0]!,
    topK,
  });
  const evidence: PublishedEvidence[] = [];
  for (const row of rows) {
    const metadata = row.metadata as Record<string, unknown>;
    if (
      metadata.tenantId !== binding.tenantId ||
      metadata.providerKind !== binding.providerKind ||
      metadata.providerAccountId !== binding.providerAccountId ||
      metadata.generationId !== generationId ||
      typeof metadata.documentHash !== "string" ||
      !metadata.documentHash ||
      !Number.isFinite(Date.parse(String(metadata.effectiveAt))) ||
      !Number.isFinite(Date.parse(String(metadata.indexedAt)))
    )
      throw new Error("Knowledge vector result has invalid provenance.");
    if (
      typeof metadata.source !== "string" ||
      typeof metadata.version !== "string" ||
      typeof metadata.title !== "string" ||
      typeof metadata.text !== "string" ||
      !metadata.text ||
      !Number.isInteger(metadata.chunkIndex) ||
      (metadata.chunkIndex as number) < 0 ||
      typeof metadata.chunkId !== "string" ||
      !metadata.chunkId
    )
      throw new Error("Knowledge vector result has incomplete provenance.");
    const authoritative = await knowledgePublicationStore.document(
      binding,
      generationId,
      metadata.source,
      metadata.documentHash,
    );
    // The vector index may be stale or corrupt. A row is usable only when its
    // source identity and all serving metadata match SQL authority, and its
    // exact generated chunk identity/content match the authoritative source.
    const authoritativeChunk = authoritative
      ? (await authoritativeChunks(authoritative)).find(
          (chunk) => chunk.chunkIndex === metadata.chunkIndex,
        )
      : undefined;
    if (
      !authoritative ||
      metadata.title !== authoritative.title ||
      metadata.version !== authoritative.version ||
      metadata.effectiveAt !== authoritative.effectiveAt ||
      metadata.expiresAt !== authoritative.expiresAt ||
      !authoritativeChunk ||
      metadata.text !== authoritativeChunk.text ||
      metadata.chunkId !== authoritativeChunk.chunkId
    )
      throw new Error(
        "Knowledge vector result does not match the publication.",
      );
    const now = Date.now();
    if (
      Date.parse(authoritative.effectiveAt) > now ||
      (authoritative.expiresAt && Date.parse(authoritative.expiresAt) <= now)
    )
      continue;
    evidence.push({ ...authoritative, text: metadata.text, score: row.score });
  }
  return evidence;
}
