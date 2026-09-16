import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseStore } from "../../src/mastra/lib/case-store";
import {
  IntercomClient,
  IntercomHttpError,
} from "../../src/mastra/providers/intercom/client";
import type { IntercomDevelopmentConfig } from "../../src/mastra/providers/intercom/config";
import { IntercomSupportProvider } from "../../src/mastra/providers/intercom/support";
import { deliverOutbox } from "../../src/mastra/runtime/local-runtime";
import type { ProviderRegistry } from "../../src/mastra/providers/contracts";

const files: string[] = [];
async function store() {
  const path = join(tmpdir(), `phase005-outbox-${crypto.randomUUID()}.db`);
  files.push(path, `${path}-wal`, `${path}-shm`);
  return storeAt(path);
}
async function storeAt(path: string) {
  const value = new CaseStore({ url: `file:${path}` });
  await value.list(); // applies app-owned migrations against real temporary SQLite
  return value;
}
function intercomCase(
  id: string,
  eventId: string,
  ownerId: string,
  binding: {
    tenantId: string;
    providerKind: "intercom";
    providerAccountId: string;
    externalConversationId: string;
  },
) {
  const acceptedAt = "2026-09-07T00:00:00.000Z";
  return {
    id,
    externalId: eventId,
    source: "intercom-conversation" as const,
    customer: { email: "synthetic@example.test" },
    subject: "Synthetic conversation",
    messages: [
      {
        id: `message-${eventId}`,
        author: "customer" as const,
        body: `synthetic ${eventId}`,
        createdAt: acceptedAt,
      },
    ],
    status: "new" as const,
    createdAt: acceptedAt,
    updatedAt: acceptedAt,
    metadata: { ownerId, providerBinding: binding },
  };
}
afterEach(async () => {
  await Promise.all(files.splice(0).map((file) => rm(file, { force: true })));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Phase 005 fenced outbox", () => {
  it("keeps a 429 delay scoped to one account and preserves immutable operation fingerprints", async () => {
    const value = await store();
    const accountA = {
      tenantId: "tenant-a",
      providerKind: "intercom" as const,
      providerAccountId: "account-a",
      externalConversationId: "c-a",
    };
    const accountB = {
      ...accountA,
      tenantId: "tenant-b",
      providerAccountId: "account-b",
      externalConversationId: "c-b",
    };
    await value.enqueueDelivery({
      id: "a",
      caseId: "case-a",
      binding: accountA,
      body: "reply",
      status: "resolved",
      operation: "reply",
    });
    await value.enqueueDelivery({
      id: "b",
      caseId: "case-b",
      binding: accountB,
      body: "reply",
      status: "resolved",
      operation: "reply",
    });
    const [first] = await value.claimOutbox(1);
    expect(first?.id).toBe("a");
    await value.retryOutbox("a", "HTTP 429", false, first?.leaseToken, 30_000);
    const [second] = await value.claimOutbox(1);
    expect(second?.id).toBe("b");
    expect(second?.operation).toBe("reply");
    expect(second?.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);
    await value.close();
  });

  it("persists an ambiguous remote POST as uncertain so it cannot be reclaimed", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "c",
    };
    await value.enqueueDelivery({
      id: "uncertain",
      caseId: "case",
      binding,
      body: "reply",
      status: "resolved",
      operation: "reply",
    });
    const [claimed] = await value.claimOutbox(1);
    await value.markOutboxUncertain(
      "uncertain",
      "network outcome unknown",
      claimed?.leaseToken,
    );
    expect(await value.claimOutbox(1)).toEqual([]);
    const row = await value
      .getClient()
      .execute("SELECT state FROM support_outbox WHERE id = 'uncertain'");
    expect(row.rows[0]?.state).toBe("uncertain");
    await value.close();
  });

  it("preserves reply, note, and status ordering and lets only one worker claim an operation", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    for (const [id, operation] of [
      ["01-reply", "reply"],
      ["02-note", "note"],
      ["03-status", "status"],
    ] as const)
      await value.enqueueDelivery({
        id,
        caseId: "case",
        binding,
        body: id,
        status: "resolved",
        operation,
      });

    const [first, competing] = await Promise.all([
      value.claimOutbox(1),
      value.claimOutbox(1),
    ]);
    expect([...first, ...competing]).toHaveLength(1);
    const claimed = first[0] ?? competing[0];
    expect(claimed).toMatchObject({ id: "01-reply", operation: "reply" });
    await value.completeOutbox(
      "01-reply",
      { receipt: "reply" },
      claimed!.leaseToken,
    );

    const [note] = await value.claimOutbox(1);
    expect(note).toMatchObject({ id: "02-note", operation: "note" });
    await value.completeOutbox(
      "02-note",
      { receipt: "note" },
      note!.leaseToken,
    );
    expect(await value.claimOutbox(1)).toMatchObject([
      { id: "03-status", operation: "status" },
    ]);
    await value.close();
  });

  it("fences an ambiguous Intercom POST through restart and never automatically issues a second POST", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    await value.enqueueDelivery({
      id: "ambiguous-post",
      caseId: "missing-case-is-safe",
      binding,
      body: "synthetic reply",
      status: "resolved",
      operation: "reply",
    });
    let posts = 0;
    const registry: ProviderRegistry = {
      support: () => ({
        kind: "intercom",
        normalizeInbound: async () => {
          throw new Error("not used");
        },
        deliver: async () => {
          posts += 1;
          throw new IntercomHttpError(0, undefined, true);
        },
        addInternalNote: async () => {
          throw new Error("not used");
        },
        updateStatus: async () => {
          throw new Error("not used");
        },
      }),
      commerce: () => {
        throw new Error("not used");
      },
      transactions: () => {
        throw new Error("not used");
      },
      knowledge: () => {
        throw new Error("not used");
      },
    };

    await deliverOutbox(registry, 10, value);
    await deliverOutbox(registry, 10, value); // simulated restarted worker
    expect(posts).toBe(1);
    expect(
      await value
        .getClient()
        .execute(
          "SELECT state FROM support_outbox WHERE id = 'ambiguous-post'",
        ),
    ).toMatchObject({ rows: [{ state: "uncertain" }] });
    await value.close();
  });

  it("retries a known failed Conversation preflight without issuing a POST", async () => {
    vi.useFakeTimers();
    for (const failure of ["http", "network"] as const) {
      vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
      const value = await store();
      const binding = {
        tenantId: "tenant",
        providerKind: "intercom" as const,
        providerAccountId: "account",
        externalConversationId: `conversation-${failure}`,
      };
      await value.enqueueDelivery({
        id: `preflight-${failure}`,
        caseId: `preflight-${failure}`,
        binding,
        body: "synthetic reply",
        status: "resolved",
        operation: "reply",
      });
      const config: IntercomDevelopmentConfig = {
        enabled: true,
        tenantId: "tenant",
        accountId: "account",
        accessToken: "synthetic-token",
        clientSecret: "synthetic-secret",
        adminId: "admin",
        apiBaseUrl: "http://intercom.test",
        knowledgeEnabled: false,
      };
      let reads = 0;
      let posts = 0;
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) => {
          if (init?.method === "GET") {
            reads += 1;
            if (reads === 1) {
              if (failure === "network") throw new TypeError("network down");
              return new Response("", { status: 503 });
            }
            return Response.json({
              type: "conversation",
              id: binding.externalConversationId,
              conversation_parts: { conversation_parts: [], total_count: 0 },
            });
          }
          posts += 1;
          return Response.json({
            type: "conversation",
            id: binding.externalConversationId,
            conversation_parts: {
              conversation_parts: [
                {
                  id: `reply-${failure}`,
                  part_type: "comment",
                  author: { type: "admin", id: "admin" },
                  body: "synthetic reply",
                },
              ],
              total_count: 1,
            },
          });
        }),
      );
      const registry = {
        support: () => support,
        commerce: () => {
          throw new Error("not used");
        },
        transactions: () => {
          throw new Error("not used");
        },
        knowledge: () => {
          throw new Error("not used");
        },
      } satisfies ProviderRegistry;

      await deliverOutbox(registry, 10, value);
      expect(posts).toBe(0);
      expect(
        await value.getClient().execute({
          sql: "SELECT state, attempts, next_attempt_at FROM support_outbox WHERE id = ?",
          args: [`preflight-${failure}`],
        }),
      ).toMatchObject({
        rows: [
          {
            state: "pending",
            attempts: 1,
            next_attempt_at: "2026-09-07T00:00:02.000Z",
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(2_000);
      await deliverOutbox(registry, 10, value);
      expect(posts).toBe(1);
      expect(
        await value.getClient().execute({
          sql: "SELECT state, attempts FROM support_outbox WHERE id = ?",
          args: [`preflight-${failure}`],
        }),
      ).toMatchObject({ rows: [{ state: "delivered", attempts: 2 }] });
      await value.close();
    }
  });

  it("quarantines blank Ticket conversion receipts without replaying their POST", async () => {
    for (const id of ["", " "]) {
      const value = await store();
      const binding = {
        tenantId: "tenant",
        providerKind: "intercom" as const,
        providerAccountId: "account",
        externalConversationId: `ticket-${JSON.stringify(id)}`,
      };
      await value.enqueueDelivery({
        id: `ticket-${JSON.stringify(id)}`,
        caseId: `ticket-${JSON.stringify(id)}`,
        binding,
        body: "synthetic escalation",
        status: "Need staff review",
        operation: "ticket",
      });
      const config: IntercomDevelopmentConfig = {
        enabled: true,
        tenantId: "tenant",
        accountId: "account",
        accessToken: "synthetic-token",
        clientSecret: "synthetic-secret",
        adminId: "admin",
        apiBaseUrl: "http://intercom.test",
        knowledgeEnabled: false,
        ticketTypeId: "ticket-type",
      };
      let posts = 0;
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) => {
          if (init?.method === "POST") posts += 1;
          return Response.json({ id });
        }),
      );
      const registry = {
        support: () => support,
        commerce: () => {
          throw new Error("not used");
        },
        transactions: () => {
          throw new Error("not used");
        },
        knowledge: () => {
          throw new Error("not used");
        },
      } satisfies ProviderRegistry;

      await deliverOutbox(registry, 10, value);
      await deliverOutbox(registry, 10, value);
      expect(posts).toBe(1);
      expect(
        await value.getClient().execute({
          sql: "SELECT state, receipt FROM support_outbox WHERE id = ?",
          args: [`ticket-${JSON.stringify(id)}`],
        }),
      ).toMatchObject({ rows: [{ state: "uncertain", receipt: null }] });
      await value.close();
    }
  });

  it("quarantines a successful Intercom POST when receipt persistence fails, including after restart", async () => {
    const path = join(tmpdir(), `phase005-outbox-${crypto.randomUUID()}.db`);
    files.push(path, `${path}-wal`, `${path}-shm`);
    const value = await storeAt(path);
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    await value.enqueueDelivery({
      id: "receipt-write-failure",
      caseId: "missing-case-is-safe",
      binding,
      body: "synthetic reply",
      status: "resolved",
      operation: "reply",
    });
    const config: IntercomDevelopmentConfig = {
      enabled: true,
      tenantId: "tenant",
      accountId: "account",
      accessToken: "synthetic-token",
      clientSecret: "synthetic-secret",
      adminId: "admin",
      apiBaseUrl: "http://intercom.test",
      knowledgeEnabled: false,
    };
    let posts = 0;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) => {
        if (init?.method === "GET")
          return Response.json({
            type: "conversation",
            id: "conversation",
            conversation_parts: { conversation_parts: [], total_count: 0 },
          });
        posts += 1;
        return Response.json({
          type: "conversation",
          id: "conversation",
          conversation_parts: {
            type: "conversation_part.list",
            conversation_parts: [
              {
                type: "conversation",
                id: "part-1",
                part_type: "comment",
                author: { type: "admin", id: "admin" },
                body: "synthetic reply",
              },
            ],
            total_count: 1,
          },
        });
      }),
    );
    const registry = {
      support: () => support,
      commerce: () => {
        throw new Error("not used");
      },
      transactions: () => {
        throw new Error("not used");
      },
      knowledge: () => {
        throw new Error("not used");
      },
    } satisfies ProviderRegistry;
    vi.spyOn(value, "completeOutbox").mockImplementationOnce(async () => {
      throw new Error("one-shot receipt persistence failure");
    });

    await deliverOutbox(registry, 10, value);
    expect(posts).toBe(1);
    expect(
      await value
        .getClient()
        .execute(
          "SELECT state FROM support_outbox WHERE id = 'receipt-write-failure'",
        ),
    ).toMatchObject({ rows: [{ state: "uncertain" }] });
    await value.close();

    const restarted = await storeAt(path);
    await deliverOutbox(registry, 10, restarted);
    expect(posts).toBe(1);
    await restarted.close();
  });

  it("quarantines a successful Intercom POST with a malformed receipt and never replays it", async () => {
    const path = join(tmpdir(), `phase005-outbox-${crypto.randomUUID()}.db`);
    files.push(path, `${path}-wal`, `${path}-shm`);
    const value = await storeAt(path);
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    await value.enqueueDelivery({
      id: "malformed-receipt",
      caseId: "missing-case-is-safe",
      binding,
      body: "synthetic reply",
      status: "resolved",
      operation: "reply",
    });
    const config: IntercomDevelopmentConfig = {
      enabled: true,
      tenantId: "tenant",
      accountId: "account",
      accessToken: "synthetic-token",
      clientSecret: "synthetic-secret",
      adminId: "admin",
      apiBaseUrl: "http://intercom.test",
      knowledgeEnabled: false,
    };
    let posts = 0;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) => {
        if (init?.method === "GET")
          return Response.json({
            type: "conversation",
            id: "conversation",
            conversation_parts: { conversation_parts: [], total_count: 0 },
          });
        posts += 1;
        return Response.json({
          type: "conversation",
          id: "conversation",
          conversation_parts: {
            type: "conversation_part.list",
            conversation_parts: [{ type: "conversation", id: " " }],
            total_count: 1,
          },
        });
      }),
    );
    const registry = {
      support: () => support,
      commerce: () => {
        throw new Error("not used");
      },
      transactions: () => {
        throw new Error("not used");
      },
      knowledge: () => {
        throw new Error("not used");
      },
    } satisfies ProviderRegistry;

    await deliverOutbox(registry, 10, value);
    expect(posts).toBe(1);
    expect(
      await value
        .getClient()
        .execute(
          "SELECT state, receipt FROM support_outbox WHERE id = 'malformed-receipt'",
        ),
    ).toMatchObject({ rows: [{ state: "uncertain", receipt: null }] });
    await deliverOutbox(registry, 10, value);
    expect(posts).toBe(1);
    await value.close();

    const reopened = await storeAt(path);
    await deliverOutbox(registry, 10, reopened);
    expect(posts).toBe(1);
    await reopened.close();
  });

  it("converts an expired durable pre-send marker to uncertainty before a restarted worker can post", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    await value.enqueueDelivery({
      id: "crash-after-post",
      caseId: "missing-case",
      binding,
      body: "reply",
      status: "resolved",
    });
    const [claimed] = await value.claimOutbox(1);
    await value.markOutboxStarted("crash-after-post", claimed!.leaseToken!);
    await value.getClient().execute({
      sql: "UPDATE support_outbox SET lease_until = ? WHERE id = ?",
      args: ["2000-01-01T00:00:00.000Z", "crash-after-post"],
    });
    let posts = 0;
    const registry = {
      support: () => ({
        kind: "intercom" as const,
        normalizeInbound: async () => {
          throw new Error("unused");
        },
        deliver: async () => {
          posts += 1;
          return {
            receiptId: "x",
            providerMessageId: "x",
            deliveredAt: new Date().toISOString(),
          };
        },
        addInternalNote: async () => {
          throw new Error("unused");
        },
        updateStatus: async () => {
          throw new Error("unused");
        },
      }),
      commerce: () => {
        throw new Error("unused");
      },
      transactions: () => {
        throw new Error("unused");
      },
      knowledge: () => {
        throw new Error("unused");
      },
    } satisfies ProviderRegistry;
    await deliverOutbox(registry, 10, value);
    expect(posts).toBe(0);
    expect(
      await value
        .getClient()
        .execute(
          "SELECT state FROM support_outbox WHERE id = 'crash-after-post'",
        ),
    ).toMatchObject({ rows: [{ state: "uncertain" }] });
    await value.close();
  });

  it("does not release status or ticket work after a failed or uncertain reply", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "account",
      externalConversationId: "conversation",
    };
    await value.enqueueDelivery({
      id: "reply",
      caseId: "ordered",
      binding,
      body: "reply",
      status: "escalated",
    });
    await value.enqueueDelivery({
      id: "status",
      caseId: "ordered",
      binding,
      body: "",
      status: "escalated",
      operation: "status",
    });
    const [reply] = await value.claimOutbox(1);
    await value.markOutboxUncertain("reply", "unknown", reply!.leaseToken);
    expect(await value.claimOutbox(10)).toEqual([]);
    await value.close();
  });

  it("installs a bounded account throttle for a 429 without Retry-After while another account proceeds", async () => {
    const value = await store();
    const a = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "a",
      externalConversationId: "a",
    };
    const b = { ...a, providerAccountId: "b", externalConversationId: "b" };
    await value.enqueueDelivery({
      id: "a-1",
      caseId: "a-1",
      binding: a,
      body: "x",
      status: "resolved",
    });
    await value.enqueueDelivery({
      id: "a-2",
      caseId: "a-2",
      binding: a,
      body: "x",
      status: "resolved",
    });
    await value.enqueueDelivery({
      id: "b-1",
      caseId: "b-1",
      binding: b,
      body: "x",
      status: "resolved",
    });
    const [first] = await value.claimOutbox(1);
    await value.retryOutbox(
      first!.id,
      "HTTP 429",
      false,
      first!.leaseToken,
      undefined,
      true,
    );
    expect(await value.claimOutbox(10)).toMatchObject([{ id: "b-1" }]);
    await value.close();
  });

  it("honors a provider-directed wait beyond one minute while another account progresses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const value = await store();
    const a = {
      tenantId: "tenant",
      providerKind: "intercom" as const,
      providerAccountId: "a",
      externalConversationId: "a",
    };
    const b = { ...a, providerAccountId: "b", externalConversationId: "b" };
    for (const [id, binding] of [
      ["a-1", a],
      ["a-2", a],
      ["b-1", b],
    ] as const)
      await value.enqueueDelivery({
        id,
        caseId: id,
        binding,
        body: "x",
        status: "resolved",
      });
    const [first] = await value.claimOutbox(1);
    expect(first?.id).toBe("a-1");
    await value.retryOutbox(
      first!.id,
      "HTTP 429 Retry-After: 120",
      false,
      first!.leaseToken,
      120_000,
      true,
    );
    expect(
      await value.getClient().execute({
        sql: "SELECT next_attempt_at FROM support_outbox WHERE id = ?",
        args: ["a-1"],
      }),
    ).toMatchObject({
      rows: [{ next_attempt_at: "2026-09-07T00:02:00.000Z" }],
    });
    const [bClaim] = await value.claimOutbox(10);
    expect(bClaim).toMatchObject({ id: "b-1" });
    await value.completeOutbox(bClaim!.id, {}, bClaim!.leaseToken);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(await value.claimOutbox(10)).toEqual([]);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(await value.claimOutbox(10)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "a-1" })]),
    );
    await value.close();
  });

  it("retains a canonical Conversation owner, allows its durable follow-up once, and isolates another tenant", async () => {
    const value = await store();
    const binding = {
      tenantId: "tenant-a",
      providerKind: "intercom" as const,
      providerAccountId: "account-a",
      externalConversationId: "conversation-shared",
    };
    const owner = "intercom:tenant-a:contact:contact-a";
    await value.acceptInbound(
      intercomCase("canonical", "event-first", owner, binding),
      "event-first",
      "run-first",
    );
    await expect(
      value.acceptInbound(
        intercomCase(
          "attacker-case",
          "event-attacker",
          "intercom:tenant-a:contact:attacker",
          binding,
        ),
        "event-attacker",
        "run-attacker",
      ),
    ).rejects.toThrow("owned by another principal");

    const followUp = await value.acceptInbound(
      intercomCase("follow-up", "event-follow-up", owner, binding),
      "event-follow-up",
      "run-follow-up",
    );
    expect(followUp).toMatchObject({
      caseId: "canonical",
      appendRequired: true,
    });
    const input = intercomCase("ignored", "event-follow-up", owner, binding);
    const first = await value.appendFollowUp({
      caseId: "canonical",
      eventId: "event-follow-up",
      runId: "run-follow-up",
      message: input.messages[0]!,
      expectedOwnerId: owner,
    });
    expect(first.appended).toBe(true);
    await expect(
      value.appendFollowUp({
        caseId: "canonical",
        eventId: "event-follow-up",
        runId: "run-replay",
        message: input.messages[0]!,
        expectedOwnerId: owner,
      }),
    ).resolves.toMatchObject({ appended: false });

    const tenantB = {
      ...binding,
      tenantId: "tenant-b",
      providerAccountId: "account-b",
    };
    await expect(
      value.acceptInbound(
        intercomCase(
          "other-tenant",
          "event-first",
          "intercom:tenant-b:contact:contact-a",
          tenantB,
        ),
        "event-first",
        "run-tenant-b",
      ),
    ).resolves.toMatchObject({ caseId: "other-tenant", isNew: true });
    await value.close();
  });
});
