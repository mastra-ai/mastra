import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { IntercomClient } from "../../src/mastra/providers/intercom/client";
import { IntercomHttpError } from "../../src/mastra/providers/intercom/client";
import { IntercomKnowledgeProvider } from "../../src/mastra/providers/intercom/knowledge";
import { IntercomSupportProvider } from "../../src/mastra/providers/intercom/support";
import type { IntercomDevelopmentConfig } from "../../src/mastra/providers/intercom/config";

const config: IntercomDevelopmentConfig = {
  enabled: true,
  tenantId: "tenant",
  accountId: "app",
  accessToken: "token",
  clientSecret: "secret",
  adminId: "9",
  apiBaseUrl: "http://intercom.test",
  knowledgeEnabled: false,
  ticketTypeId: "type_1",
};
const binding = {
  tenantId: "tenant",
  providerKind: "intercom" as const,
  providerAccountId: "app",
  externalConversationId: "123",
};

function conversationMutation(
  partId: string | number,
  body = "",
  partType = "comment",
  state?: "open" | "closed",
) {
  return {
    type: "conversation",
    id: binding.externalConversationId,
    ...(state ? { state } : {}),
    conversation_parts: {
      type: "conversation_part.list",
      conversation_parts: [
        {
          type: "conversation",
          id: partId,
          part_type: partType,
          author: { type: "admin", id: "9" },
          body,
        },
      ],
      total_count: 1,
    },
  };
}
function conversationSnapshot(
  parts: Array<Record<string, unknown>> = [],
  state?: "open" | "closed",
) {
  return {
    type: "conversation",
    id: binding.externalConversationId,
    ...(state ? { state } : {}),
    conversation_parts: {
      type: "conversation_part.list",
      conversation_parts: parts,
      total_count: parts.length,
    },
  };
}

describe("Intercom v2.16 support contract", () => {
  it("uses a nonempty fallback note for blank escalation reasons", () => {
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async () => Response.json({})),
    );
    expect(
      support.planFinalizationOutbox!({
        status: "escalated",
        subject: "Cancellation",
        escalationReason: "  ",
      }),
    ).toContainEqual(
      expect.objectContaining({
        operation: "note",
        body: "Support escalation requires staff review.",
      }),
    );
  });

  it("uses the documented reply and conversation conversion schemas", async () => {
    const requests: Request[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      const url = new URL(String(input));
      return Response.json(
        url.pathname.endsWith("/convert")
          ? { type: "ticket", id: "api-ticket", ticket_id: "display-ticket" }
          : init?.method === "GET"
            ? conversationSnapshot()
            : conversationMutation("reply-part-1", "hello"),
      );
    };
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, fakeFetch),
    );
    await expect(
      support.deliver(binding, "hello", "resolved", "ignored"),
    ).resolves.toMatchObject({
      receiptId: "intercom:reply:reply-part-1",
      providerMessageId: "reply-part-1",
    });
    const ticket = await support.convertToTicket!(
      binding,
      { title: "Need review", description: "reason" },
      "ignored",
    );
    expect(ticket.providerMessageId).toBe("api-ticket");
    expect(requests[0].headers.get("intercom-version")).toBe("2.16");
    expect(new URL(requests[0].url).pathname).toBe("/conversations/123");
    expect(new URL(requests[1].url).pathname).toBe("/conversations/123/reply");
    await expect(requests[1].json()).resolves.toMatchObject({
      message_type: "comment",
      type: "admin",
      admin_id: "9",
      body: "hello",
    });
    expect(new URL(requests[2].url).pathname).toBe(
      "/conversations/123/convert",
    );
    await expect(requests[2].json()).resolves.toEqual({
      ticket_type_id: "type_1",
      attributes: {
        _default_title_: "Need review",
        _default_description_: "reason",
      },
    });
  });

  it("maps notes and lifecycle status to the canonical conversation and does not invent tickets", async () => {
    const requests: Request[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      const count = requests.length;
      if (init?.method === "GET")
        return Response.json(
          conversationSnapshot([], count === 3 ? "closed" : "open"),
        );
      return Response.json(
        conversationMutation(
          `part-${count / 2}`,
          count === 2 ? "synthetic escalation context" : "",
          count === 2 ? "note" : count === 4 ? "open" : "close",
          count === 4 ? "open" : count === 6 ? "closed" : undefined,
        ),
      );
    };
    const support = new IntercomSupportProvider(
      { ...config, ticketTypeId: undefined },
      new IntercomClient({ ...config, ticketTypeId: undefined }, fakeFetch),
    );

    const note = await support.addInternalNote(
      binding,
      "synthetic escalation context",
      "note",
    );
    const opened = await support.updateStatus(binding, "escalated", "open");
    const closed = await support.updateStatus(binding, "resolved", "close");
    await expect(
      support.convertToTicket!(
        binding,
        { title: "x", description: "y" },
        "ticket",
      ),
    ).rejects.toThrow("not configured");

    expect(requests).toHaveLength(6);
    expect(
      [note, opened, closed].map((receipt) => receipt.providerMessageId),
    ).toEqual(["part-1", "part-2", "part-3"]);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/conversations/123",
      "/conversations/123/reply",
      "/conversations/123",
      "/conversations/123/parts",
      "/conversations/123",
      "/conversations/123/parts",
    ]);
    await expect(requests[1]!.json()).resolves.toMatchObject({
      message_type: "note",
      type: "admin",
      admin_id: "9",
    });
    await expect(requests[3]!.json()).resolves.toMatchObject({
      message_type: "open",
      type: "admin",
    });
    await expect(requests[5]!.json()).resolves.toMatchObject({
      message_type: "close",
      type: "admin",
    });
  });

  it("requires a usable Ticket API id while preserving valid string and numeric ids", async () => {
    for (const id of ["api-ticket", 42] as const) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async () => Response.json({ id })),
      );
      await expect(
        support.convertToTicket!(
          binding,
          { title: "Need review", description: "reason" },
          "ignored",
        ),
      ).resolves.toMatchObject({
        receiptId: `intercom:ticket:${id}`,
        providerMessageId: String(id),
      });
    }

    for (const id of ["", " "]) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async () => Response.json({ id })),
      );
      await expect(
        support.convertToTicket!(
          binding,
          { title: "Need review", description: "reason" },
          "ignored",
        ),
      ).rejects.toMatchObject({ status: 200, ambiguous: true });
    }
  });

  it("preserves valid string and numeric provider part IDs exactly", async () => {
    for (const [partId, expected] of [
      ["part-with-spacing ", "part-with-spacing "],
      [42, "42"],
    ] as const) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) =>
          Response.json(
            init?.method === "GET"
              ? conversationSnapshot()
              : conversationMutation(partId, "body"),
          ),
        ),
      );
      await expect(
        support.deliver(binding, "body", "resolved", "ignored"),
      ).resolves.toMatchObject({
        receiptId: `intercom:reply:${expected}`,
        providerMessageId: expected,
      });
    }
  });

  it("persists distinct created-part receipts for repeated operations on one Conversation", async () => {
    let sequence = 0;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) => {
        if (init?.method === "GET")
          return Response.json(conversationSnapshot());
        sequence += 1;
        return Response.json(
          conversationMutation(`reply-part-${sequence}`, "same target"),
        );
      }),
    );
    const first = await support.deliver(binding, "same target", "resolved");
    const second = await support.deliver(binding, "same target", "resolved");
    expect(first).toMatchObject({
      receiptId: "intercom:reply:reply-part-1",
      providerMessageId: "reply-part-1",
    });
    expect(second).toMatchObject({
      receiptId: "intercom:reply:reply-part-2",
      providerMessageId: "reply-part-2",
    });
  });

  it("identifies a reply in a full Conversation response by its new semantic admin part", async () => {
    const prior = {
      id: "prior-identical-admin-reply",
      part_type: "comment",
      author: { type: "admin", id: "9" },
      body: "Exact reply body.",
    };
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) =>
        Response.json(
          init?.method === "GET"
            ? conversationSnapshot([prior], "open")
            : conversationSnapshot(
                [
                  prior,
                  {
                    id: "bot-attribute-update",
                    part_type: "conversation_attribute_updated_by_admin",
                    author: { type: "bot", id: "bot" },
                    body: null,
                  },
                  {
                    id: "automatic-assignment-reply",
                    part_type: "assignment",
                    author: { type: "admin", id: "9" },
                    body: "<p>Exact reply body.</p>",
                  },
                ],
                "open",
              ),
        ),
      ),
    );

    await expect(
      support.deliver(binding, "Exact reply body.", "resolved", "ignored"),
    ).resolves.toMatchObject({
      receiptId: "intercom:reply:automatic-assignment-reply",
      providerMessageId: "automatic-assignment-reply",
    });
  });

  it("accepts only Intercom's exact escaped paragraph rendering for note receipts", async () => {
    const body = `Review <policy> & "quote" 'single'.`;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) =>
        Response.json(
          init?.method === "GET"
            ? conversationSnapshot([
                {
                  id: "historical-system-part",
                  part_type: "conversation_attribute_updated_by_admin",
                  author: { type: "bot", id: "bot" },
                  body: null,
                },
              ])
            : conversationSnapshot([
                {
                  id: "historical-system-part",
                  part_type: "conversation_attribute_updated_by_admin",
                  author: { type: "bot", id: "bot" },
                  body: null,
                },
                {
                  id: "wrapped-note",
                  part_type: "note",
                  author: { type: "admin", id: "9" },
                  body: "<p>Review &lt;policy&gt; &amp; &quot;quote&quot; &#39;single&#39;.</p>",
                },
              ]),
        ),
      ),
    );

    await expect(
      support.addInternalNote(binding, body, "ignored"),
    ).resolves.toMatchObject({
      receiptId: "intercom:note:wrapped-note",
      providerMessageId: "wrapped-note",
    });
  });

  it("rejects semantically different HTML that only looks like the sent reply", async () => {
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) =>
        Response.json(
          init?.method === "GET"
            ? conversationSnapshot()
            : conversationSnapshot([
                {
                  id: "same-visible-text-extra-content",
                  part_type: "assignment",
                  author: { type: "admin", id: "9" },
                  body: "<p>Visible reply.</p><!-- different provider content -->",
                },
              ]),
        ),
      ),
    );

    await expect(
      support.deliver(binding, "Visible reply.", "resolved", "ignored"),
    ).rejects.toThrow("cannot unambiguously");
  });

  it("quarantines ambiguous concurrent matching reply parts instead of selecting by position", async () => {
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) =>
        Response.json(
          init?.method === "GET"
            ? conversationSnapshot()
            : conversationSnapshot([
                {
                  id: "candidate-a",
                  part_type: "comment",
                  author: { type: "admin", id: "9" },
                  body: "Same reply.",
                },
                {
                  id: "candidate-b",
                  part_type: "assignment",
                  author: { type: "admin", id: "9" },
                  body: "Same reply.",
                },
              ]),
        ),
      ),
    );
    await expect(
      support.deliver(binding, "Same reply.", "resolved", "ignored"),
    ).rejects.toThrow("cannot unambiguously");
  });

  it("records a verified status no-op without claiming a created provider part", async () => {
    let posts = 0;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) => {
        if (init?.method === "POST") posts += 1;
        return Response.json(conversationSnapshot([], "closed"));
      }),
    );
    await expect(
      support.updateStatus(binding, "resolved", "ignored"),
    ).resolves.toEqual({
      receiptId: "intercom:status:no-op:123",
      deliveredAt: expect.any(String),
    });
    expect(posts).toBe(0);
  });

  it("accepts null status bodies only as no-body and rejects status content", async () => {
    for (const [body, expected] of [
      [null, true],
      ["unexpected status content", false],
    ] as const) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) =>
          Response.json(
            init?.method === "GET"
              ? conversationSnapshot([], "open")
              : conversationSnapshot(
                  [
                    {
                      id: "new-status-part",
                      part_type: "close",
                      author: { type: "admin", id: "9" },
                      body,
                    },
                  ],
                  "closed",
                ),
          ),
        ),
      );
      const result = support.updateStatus(binding, "resolved", "ignored");
      if (expected)
        await expect(result).resolves.toMatchObject({
          receiptId: "intercom:status:new-status-part",
          providerMessageId: "new-status-part",
        });
      else await expect(result).rejects.toThrow("cannot unambiguously");
    }
  });

  it("rejects status mutation receipts whose full Conversation lacks or contradicts the desired state", async () => {
    for (const state of [undefined, "open"] as const) {
      let posts = 0;
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) => {
          if (init?.method === "POST") posts += 1;
          return Response.json(
            init?.method === "GET"
              ? conversationSnapshot([], "open")
              : conversationSnapshot(
                  [
                    {
                      id: "new-close-part",
                      part_type: "close",
                      author: { type: "admin", id: "9" },
                      body: null,
                    },
                  ],
                  state,
                ),
          );
        }),
      );

      await expect(
        support.updateStatus(binding, "resolved", "ignored"),
      ).rejects.toThrow("does not demonstrate the desired Conversation state");
      expect(posts).toBe(1);
    }
  });

  it("does not POST when the pre-mutation Conversation read fails", async () => {
    let posts = 0;
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (_input, init) => {
        if (init?.method === "POST") posts += 1;
        return new Response("", { status: 500 });
      }),
    );
    await expect(
      support.deliver(binding, "Never sent.", "resolved", "ignored"),
    ).rejects.toMatchObject({
      status: 500,
      ambiguous: false,
      requestMethod: "GET",
    });
    expect(posts).toBe(0);
  });

  it("does not POST replies or notes when the pre-mutation Conversation binding or snapshot is malformed", async () => {
    for (const response of [
      { type: "conversation", id: binding.externalConversationId },
      { type: "conversation", id: "other-conversation" },
    ]) {
      for (const operation of ["reply", "note"] as const) {
        let posts = 0;
        const support = new IntercomSupportProvider(
          config,
          new IntercomClient(config, async (_input, init) => {
            if (init?.method === "POST") posts += 1;
            return Response.json(response);
          }),
        );
        const result =
          operation === "reply"
            ? support.deliver(binding, "Never sent.", "resolved", "ignored")
            : support.addInternalNote(binding, "Never sent.", "ignored");
        await expect(result).rejects.toThrow(
          response.id === "other-conversation"
            ? "does not match the bound Conversation"
            : "lacks a conversation-part snapshot",
        );
        expect(posts).toBe(0);
      }
    }
  });

  it("keeps optional articles tenant-bound, source-versioned, and fresh before publication", async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/articles")
        return Response.json({
          data: [
            {
              id: "stale",
              title: "Stale synthetic article",
              body: "old policy",
              state: "published",
              updated_at: 1_700_000_000,
            },
            {
              id: "fresh",
              title: "Fresh synthetic article",
              body: "refund review policy",
              state: "published",
              updated_at: 1_800_000_000,
            },
          ],
          pages: { page: 1, per_page: 50, total_pages: 1, next: null },
        });
      expect(path).toBe("/articles/fresh");
      return Response.json({
        id: "fresh",
        title: "Fresh synthetic article",
        body: "refund review policy",
        state: "published",
        updated_at: 1_800_000_000,
      });
    };
    const enabled = { ...config, knowledgeEnabled: true };
    const knowledge = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, fakeFetch),
    );
    const articleBinding = { ...binding, externalConversationId: "knowledge" };
    await expect(
      new IntercomKnowledgeProvider(
        config,
        new IntercomClient(config, fakeFetch),
      ).listChanged(articleBinding),
    ).rejects.toThrow("not enabled");

    await expect(
      knowledge.listChanged(articleBinding, "2025-01-01T00:00:00.000Z"),
    ).resolves.toEqual([
      {
        source: "intercom:article:fresh",
        version: "1800000000",
        changedAt: "2027-01-15T08:00:00.000Z",
      },
    ]);
    await expect(
      knowledge.fetchDocument(articleBinding, "intercom:article:fresh"),
    ).resolves.toMatchObject({
      source: "intercom:article:fresh",
      version: "1800000000",
      effectiveAt: "2027-01-15T08:00:00.000Z",
      text: "refund review policy",
    });
  });

  it("uses the signed source only for a created conversation and enriches its Contact Reference", async () => {
    const requests: Request[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({
        id: "author-contact",
        email: "author@example.test",
        name: "Author",
      });
    };
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, fakeFetch),
    );
    const normalized = await support.normalizeInbound({
      id: "evt-contact",
      topic: "conversation.user.created",
      created_at: 1_800_000_000,
      binding,
      data: {
        item: {
          id: "123",
          contacts: {
            contacts: [{ id: "another-contact", email: "wrong@example.test" }],
          },
          source: {
            author: { type: "contact", id: "author-contact" },
            body: "actual follow-up",
          },
        },
      },
    });
    expect(new URL(requests[0]!.url).pathname).toBe("/contacts/author-contact");
    expect(normalized.customer.email).toBe("author@example.test");
    expect(normalized.rawPayload.contactId).toBe("author-contact");
    expect(normalized.message.body).toBe("actual follow-up");
  });

  it("accepts a signed lead author only through its own Contact enrichment", async () => {
    const requests: Request[] = [];
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({
          id: "lead-author",
          email: "lead@example.test",
          name: "Lead Author",
        });
      }),
    );
    const normalized = await support.normalizeInbound({
      id: "evt-lead-created",
      topic: "conversation.user.created",
      created_at: 1_800_000_000,
      binding,
      data: {
        item: {
          id: "123",
          contacts: {
            contacts: [{ id: "unrelated", email: "wrong@example.test" }],
          },
          source: {
            id: "lead-source",
            author: { type: "lead", id: "lead-author" },
            body: "Lead-created conversation.",
          },
        },
      },
    });
    expect(new URL(requests[0]!.url).pathname).toBe("/contacts/lead-author");
    expect(normalized.customer.email).toBe("lead@example.test");
    expect(normalized.rawPayload.contactId).toBe("lead-author");
  });

  it("rejects a signed visitor reply instead of deriving an identity from another participant", async () => {
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async () => {
        throw new Error("visitor enrichment must not run");
      }),
    );
    await expect(
      support.normalizeInbound({
        id: "evt-visitor",
        topic: "conversation.user.replied",
        created_at: 1_800_000_000,
        binding,
        data: {
          item: {
            id: "123",
            contacts: {
              contacts: [{ id: "contact-a", email: "wrong@example.test" }],
            },
            conversation_parts: {
              conversation_parts: [
                {
                  id: "visitor-part",
                  author: { type: "visitor", id: "visitor-a" },
                  body: "Visitor-only identity.",
                  created_at: 1_800_000_000,
                },
              ],
            },
          },
        },
      }),
    ).rejects.toThrow("unambiguous customer reply part");
  });

  it("treats missing, blank, ambiguous, or misbound mutation parts as an uncertain receipt", async () => {
    for (const response of [
      { type: "conversation", id: "123" },
      {
        ...conversationMutation("first"),
        conversation_parts: {
          conversation_parts: [{ id: "first" }, { id: "second" }],
        },
      },
      { ...conversationMutation("wrong-target"), id: "other-conversation" },
    ]) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) =>
          Response.json(
            init?.method === "GET" ? conversationSnapshot() : response,
          ),
        ),
      );
      await expect(
        support.deliver(binding, "body", "resolved", "ignored"),
      ).rejects.toThrow(/mutation response/);
    }

    for (const partId of ["", "   "]) {
      const support = new IntercomSupportProvider(
        config,
        new IntercomClient(config, async (_input, init) =>
          Response.json(
            init?.method === "GET"
              ? conversationSnapshot()
              : conversationMutation(partId, "body"),
          ),
        ),
      );
      await expect(
        support.deliver(binding, "body", "resolved", "ignored"),
      ).rejects.toMatchObject({ status: 200, ambiguous: true });
    }
  });

  it("uses the terminal signed customer part for a reply, not the initial source or another participant", async () => {
    const requests: Request[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({
        id: "reply-contact",
        email: "reply@example.test",
        name: "Reply Contact",
      });
    };
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, fakeFetch),
    );
    const normalized = await support.normalizeInbound({
      id: "evt-follow-up",
      topic: "conversation.user.replied",
      created_at: 1_800_000_003,
      binding,
      data: {
        item: {
          id: "123",
          title: "Admin-started conversation",
          source: {
            id: "initial-admin-message",
            author: { type: "admin", id: "admin-1" },
            body: "first message from support",
          },
          contacts: {
            contacts: [
              { id: "unrelated-contact", email: "wrong@example.test" },
              { id: "initial-contact", email: "also-wrong@example.test" },
            ],
          },
          conversation_parts: {
            conversation_parts: [
              {
                id: "prior-admin-part",
                author: { type: "admin", id: "admin-1" },
                body: "Please reply with more detail.",
                created_at: 1_800_000_001,
              },
              {
                id: "actual-customer-reply",
                author: { type: "contact", id: "reply-contact" },
                body: "The actual follow-up text.",
                created_at: 1_800_000_002,
              },
            ],
          },
        },
      },
    });
    expect(new URL(requests[0]!.url).pathname).toBe("/contacts/reply-contact");
    expect(normalized.customer.email).toBe("reply@example.test");
    expect(normalized.rawPayload.contactId).toBe("reply-contact");
    expect(normalized.message).toMatchObject({
      id: "intercom_part_actual-customer-reply",
      body: "The actual follow-up text.",
      createdAt: "2027-01-15T08:00:02.000Z",
    });
  });

  it("rejects a reply snapshot without an unambiguous terminal customer part instead of reusing the source", async () => {
    const support = new IntercomSupportProvider(
      config,
      new IntercomClient(config, async () => {
        throw new Error("contact lookup must not run");
      }),
    );
    await expect(
      support.normalizeInbound({
        id: "evt-ambiguous",
        topic: "conversation.user.replied",
        created_at: 1_800_000_003,
        binding,
        data: {
          item: {
            id: "123",
            source: {
              id: "initial-customer-message",
              author: { type: "contact", id: "initial-contact" },
              body: "old initial text must not be used",
            },
            conversation_parts: {
              conversation_parts: [
                {
                  id: "customer-part",
                  author: { type: "contact", id: "initial-contact" },
                  body: "earlier customer body",
                  created_at: 1_800_000_001,
                },
                {
                  id: "later-admin-part",
                  author: { type: "admin", id: "admin-1" },
                  body: "a concurrent admin message",
                  created_at: 1_800_000_002,
                },
              ],
            },
          },
        },
      }),
    ).rejects.toThrow("unambiguous customer reply part");
  });

  it("marks HTTP 408 and malformed successful POST receipts as ambiguous", async () => {
    const timeoutClient = new IntercomClient(
      config,
      async () => new Response("", { status: 408 }),
    );
    await expect(
      timeoutClient.request("/conversations/123/reply", { method: "POST" }),
    ).rejects.toMatchObject({ ambiguous: true, status: 408 });
    const invalidClient = new IntercomClient(config, async () =>
      Response.json({ wrong: "shape" }),
    );
    await expect(
      invalidClient.request(
        "/conversations/123/reply",
        { method: "POST" },
        z.object({ id: z.string() }),
      ),
    ).rejects.toBeInstanceOf(IntercomHttpError);
    await expect(
      invalidClient.request(
        "/conversations/123/reply",
        { method: "POST" },
        z.object({ id: z.string() }),
      ),
    ).rejects.toMatchObject({ ambiguous: true });
  });

  it("retains numeric, date, and reset rate-limit waits beyond one minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const date = new Date(Date.now() + 120_000).toUTCString();
    const reset = String(Math.floor(Date.now() / 1_000) + 120);
    for (const headers of [
      { "retry-after": "120" },
      { "retry-after": date },
      { "x-ratelimit-reset": reset },
    ]) {
      const client = new IntercomClient(
        config,
        async () => new Response("", { status: 429, headers }),
      );
      await expect(
        client.request("/conversations/123/reply", { method: "POST" }),
      ).rejects.toMatchObject({
        status: 429,
        retryAfterMs: 120_000,
        ambiguous: false,
      });
    }
    vi.useRealTimers();
  });

  it("fails explicitly instead of shortening an unsupported provider retry wait", async () => {
    const client = new IntercomClient(
      config,
      async () =>
        new Response("", {
          status: 429,
          headers: { "retry-after": "2592001" },
        }),
    );
    await expect(
      client.request("/conversations/123/reply", { method: "POST" }),
    ).rejects.toThrow("outside scheduler bounds");
  });

  it("paginates published article candidates and rejects an unpublished fetch race", async () => {
    const paths: string[] = [];
    const enabled = { ...config, knowledgeEnabled: true };
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      paths.push(`${url.pathname}${url.search}`);
      if (url.pathname === "/articles/fresh")
        return Response.json({
          id: "fresh",
          state: "draft",
          body: "must not activate",
          updated_at: 1_800_000_000,
        });
      if (url.searchParams.get("starting_after") === "fresh")
        return Response.json({
          data: [
            {
              id: "second",
              state: "published",
              body: "second policy",
              updated_at: 1_800_000_001,
            },
          ],
          pages: { page: 2, per_page: 50, total_pages: 2, next: null },
        });
      return Response.json({
        data: [
          {
            id: "fresh",
            state: "published",
            body: "first policy",
            updated_at: 1_800_000_000,
          },
          {
            id: "draft",
            state: "draft",
            body: "private",
            updated_at: 1_800_000_000,
          },
        ],
        pages: {
          page: 1,
          per_page: 50,
          total_pages: 2,
          next: { starting_after: "fresh", per_page: 50 },
        },
      });
    };
    const knowledge = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, fakeFetch),
    );
    const articleBinding = { ...binding, externalConversationId: "knowledge" };
    await expect(knowledge.listChanged(articleBinding)).resolves.toEqual([
      expect.objectContaining({ source: "intercom:article:fresh" }),
      expect.objectContaining({ source: "intercom:article:second" }),
    ]);
    expect(paths).toContain("/articles?per_page=50&starting_after=fresh");
    await expect(
      knowledge.fetchDocument(articleBinding, "intercom:article:fresh"),
    ).resolves.toBeUndefined();
  });

  it.each(["absent", "null"] as const)(
    "accepts a terminal empty Articles page with %s next cursor",
    async (nextKind) => {
      const enabled = { ...config, knowledgeEnabled: true };
      const pages = {
        type: "pages",
        page: 1,
        per_page: 50,
        total_pages: 0,
        ...(nextKind === "null" ? { next: null } : {}),
      };
      const knowledge = new IntercomKnowledgeProvider(
        enabled,
        new IntercomClient(enabled, async () =>
          Response.json({
            type: "list",
            total_count: 0,
            data: [],
            pages,
          }),
        ),
      );
      const articleBinding = {
        ...binding,
        externalConversationId: "knowledge",
      };

      await expect(knowledge.listChanged(articleBinding)).resolves.toEqual([]);
    },
  );

  it("fails closed for malformed and repeated article cursors", async () => {
    const enabled = { ...config, knowledgeEnabled: true };
    const articleBinding = { ...binding, externalConversationId: "knowledge" };
    const malformed = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, async () =>
        Response.json({
          data: [],
          pages: {
            page: 1,
            per_page: 50,
            total_pages: 2,
            next: { starting_after: "cursor", per_page: 0 },
          },
        }),
      ),
    );
    await expect(malformed.listChanged(articleBinding)).rejects.toThrow(
      "malformed cursor",
    );

    const filteredDrafts = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, async () =>
        Response.json({
          data: [
            {
              id: "draft",
              state: "draft",
              body: "must not disguise a nonempty page",
              updated_at: 1_800_000_000,
            },
          ],
          pages: { page: 1, per_page: 50, total_pages: 0, next: null },
        }),
      ),
    );
    await expect(filteredDrafts.listChanged(articleBinding)).rejects.toThrow(
      "pagination response is malformed",
    );

    const laterTerminalEmpty = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, async (input) => {
        const url = new URL(String(input));
        if (url.searchParams.has("starting_after"))
          return Response.json({
            data: [],
            pages: { page: 1, per_page: 50, total_pages: 0, next: null },
          });
        return Response.json({
          data: [
            {
              id: "first",
              state: "published",
              body: "first policy",
              updated_at: 1_800_000_000,
            },
          ],
          pages: {
            page: 1,
            per_page: 50,
            total_pages: 2,
            next: { starting_after: "first", per_page: 50 },
          },
        });
      }),
    );
    await expect(
      laterTerminalEmpty.listChanged(articleBinding),
    ).rejects.toThrow("pagination response is malformed");

    let requests = 0;
    const repeated = new IntercomKnowledgeProvider(
      enabled,
      new IntercomClient(enabled, async () => {
        requests += 1;
        return Response.json({
          data: [],
          pages: {
            page: requests,
            per_page: 50,
            total_pages: 3,
            next: { starting_after: "cursor", per_page: 50 },
          },
        });
      }),
    );
    await expect(repeated.listChanged(articleBinding)).rejects.toThrow(
      "repeated a page",
    );
    expect(requests).toBe(2);
  });
});
