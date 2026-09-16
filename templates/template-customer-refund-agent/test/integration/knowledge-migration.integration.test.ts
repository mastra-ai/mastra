import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { LocalRuntime } from "../../src/mastra/runtime/local-runtime";
import { POLICY_DOCUMENTS } from "../../src/mastra/knowledge/policy-docs";
import {
  KnowledgePublicationStore,
  knowledgeAccountKey,
} from "../../src/mastra/lib/knowledge-publications";
import { temporaryDatabasePath } from "../support/temp-path";

const paths: string[] = [];

afterEach(async () => {
  await Promise.all(paths.splice(0).map((path) => rm(path, { force: true })));
});

describe("Phase 003 local knowledge migration", () => {
  it("lets simultaneous clients initialize one fresh publication store and both remain usable", async () => {
    const path = temporaryDatabasePath("knowledge-concurrent-migration");
    paths.push(path, `${path}-shm`, `${path}-wal`);
    const firstClient = createClient({ url: `file:${path}` });
    const secondClient = createClient({ url: `file:${path}` });
    const first = new KnowledgePublicationStore(firstClient);
    const second = new KnowledgePublicationStore(secondClient);
    const firstBinding = {
      tenantId: `first-${crypto.randomUUID()}`,
      providerKind: "local" as const,
      providerAccountId: `first-account-${crypto.randomUUID()}`,
      externalConversationId: "migration-concurrency-test",
    };
    const secondBinding = {
      tenantId: `second-${crypto.randomUUID()}`,
      providerKind: "local" as const,
      providerAccountId: `second-account-${crypto.randomUUID()}`,
      externalConversationId: "migration-concurrency-test",
    };

    await expect(
      Promise.all([
        first.publication(firstBinding),
        second.publication(secondBinding),
      ]),
    ).resolves.toEqual([
      { generationId: undefined, revision: 0 },
      { generationId: undefined, revision: 0 },
    ]);
    const firstCandidate = await first.buildCandidate(firstBinding, [
      {
        source: "policy://first",
        title: "First policy",
        text: "first client remains usable after migration",
        version: "v1",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        score: 1,
      },
    ]);
    const secondCandidate = await second.buildCandidate(secondBinding, [
      {
        source: "policy://second",
        title: "Second policy",
        text: "second client remains usable after migration",
        version: "v1",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        score: 1,
      },
    ]);
    await first.activate(firstBinding, firstCandidate.generationId, {
      generationId: undefined,
      revision: 0,
    });
    await second.activate(secondBinding, secondCandidate.generationId, {
      generationId: undefined,
      revision: 0,
    });
    expect(await first.activeGeneration(firstBinding)).toBe(
      firstCandidate.generationId,
    );
    expect(await second.activeGeneration(secondBinding)).toBe(
      secondCandidate.generationId,
    );
    firstClient.close();
    secondClient.close();
  });

  it("backfills only known versioned fixture applicability and leaves unknown records unpublished", async () => {
    const path = temporaryDatabasePath("knowledge-phase003");
    paths.push(path, `${path}-shm`, `${path}-wal`);
    const client = createClient({ url: `file:${path}` });
    const known = POLICY_DOCUMENTS.find(
      (document) => document.source === "duplicate-charge-policy",
    )!;
    await client.executeMultiple(`
      CREATE TABLE local_knowledge (
        tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL,
        source TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL,
        version TEXT NOT NULL,
        PRIMARY KEY(tenant_id, provider_account_id, source)
      );
    `);
    await client.batch([
      {
        sql: "INSERT INTO local_knowledge VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          "local-demo",
          "local-demo",
          known.source,
          known.title,
          known.text,
          "local-v1",
        ],
      },
      {
        sql: "INSERT INTO local_knowledge VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          "local-demo",
          "local-demo",
          "imported://unknown",
          "Unknown import",
          "No authoritative applicability metadata.",
          "import-v7",
        ],
      },
    ]);
    const runtime = new LocalRuntime(client);
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "local-demo",
      externalConversationId: "migration-test",
    };
    expect(
      await runtime.fetchDocument(binding, "duplicate-charge-policy"),
    ).toMatchObject({ effectiveAt: "2026-01-01T00:00:00.000Z" });
    expect(
      await runtime.fetchDocument(binding, "imported://unknown"),
    ).toMatchObject({
      effectiveAt: undefined,
    });
    client.close();
  });

  it("re-keys a legacy publication pointer from its durable knowledge account", async () => {
    const path = temporaryDatabasePath("knowledge-key-migration");
    paths.push(path, `${path}-shm`, `${path}-wal`);
    const client = createClient({ url: `file:${path}` });
    const binding = {
      tenantId: "local-demo",
      providerKind: "local" as const,
      providerAccountId: "knowledge-account",
      externalConversationId: "migration-test",
    };
    await client.executeMultiple(`
      CREATE TABLE support_knowledge_schema_migrations (
        version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
      );
      CREATE TABLE support_knowledge_generations (
        id TEXT PRIMARY KEY, account_key TEXT NOT NULL, tenant_id TEXT NOT NULL,
        provider_kind TEXT NOT NULL, provider_account_id TEXT NOT NULL,
        state TEXT NOT NULL, created_at TEXT NOT NULL, activated_at TEXT,
        replaced_generation_id TEXT, base_revision INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE support_knowledge_documents (
        generation_id TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL,
        text TEXT NOT NULL, version TEXT NOT NULL, document_hash TEXT NOT NULL,
        effective_at TEXT NOT NULL, indexed_at TEXT NOT NULL, expires_at TEXT,
        provider_kind TEXT NOT NULL, provider_account_id TEXT NOT NULL,
        PRIMARY KEY(generation_id, source, document_hash)
      );
      CREATE TABLE support_knowledge_publications (
        account_key TEXT PRIMARY KEY, generation_id TEXT NOT NULL,
        revision INTEGER NOT NULL, published_at TEXT NOT NULL
      );
    `);
    await client.batch([
      {
        sql: "INSERT INTO support_knowledge_schema_migrations VALUES (1, ?)",
        args: ["2026-09-06T00:00:00.000Z"],
      },
      {
        sql: "INSERT INTO support_knowledge_generations VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NULL, 1)",
        args: [
          "legacy-generation",
          "local-demo",
          binding.tenantId,
          binding.providerKind,
          binding.providerAccountId,
          "2026-09-06T00:00:00.000Z",
          "2026-09-06T00:00:00.000Z",
        ],
      },
      {
        sql: "INSERT INTO support_knowledge_publications VALUES (?, ?, 1, ?)",
        args: ["local-demo", "legacy-generation", "2026-09-06T00:00:00.000Z"],
      },
      {
        sql: "INSERT INTO support_knowledge_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        args: [
          "legacy-generation",
          "policy://legacy",
          "Legacy policy",
          "legacy refunds require approval",
          "v1",
          createHash("sha256")
            .update(
              JSON.stringify([
                "policy://legacy",
                "v1",
                "legacy refunds require approval",
              ]),
            )
            .digest("hex"),
          "2026-01-01T00:00:00.000Z",
          "2026-09-06T00:00:00.000Z",
          binding.providerKind,
          binding.providerAccountId,
        ],
      },
    ]);

    const publications = new KnowledgePublicationStore(client);
    expect(await publications.publication(binding)).toEqual({
      generationId: "legacy-generation",
      revision: 1,
    });
    expect(
      await client.execute({
        sql: "SELECT account_key FROM support_knowledge_publications",
      }),
    ).toMatchObject({
      rows: [{ account_key: knowledgeAccountKey(binding) }],
    });
    expect(
      await client.execute({
        sql: "SELECT expected_document_count, manifest_hash, sealed_at FROM support_knowledge_generations WHERE id = ?",
        args: ["legacy-generation"],
      }),
    ).toMatchObject({
      rows: [
        {
          expected_document_count: 1,
          manifest_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          sealed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      ],
    });
    const replacement = await publications.buildCandidate(binding, [
      {
        source: "policy://replacement",
        title: "Replacement policy",
        text: "replacement refunds require a documented review",
        version: "v2",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        score: 1,
      },
    ]);
    await publications.activate(
      binding,
      replacement.generationId,
      await publications.publication(binding),
    );
    await publications.rollback(binding, "legacy-generation");
    expect(await publications.publication(binding)).toMatchObject({
      generationId: "legacy-generation",
      revision: 3,
    });
    client.close();
  });
});
