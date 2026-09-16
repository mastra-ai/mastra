import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasAnyRole,
  listCases,
  SessionExpiredError,
  submitCase,
  type SupportSession,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("support API client", () => {
  it("sends the shared inbound DTO and returns the documented acceptance envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          caseId: "case-1",
          workflowRunId: "run-1",
          status: "processing",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitCase({
        externalId: "web-1",
        from: "alex@example.test",
        subject: "Help",
        body: "Please help.",
      }),
    ).resolves.toEqual({
      caseId: "case-1",
      workflowRunId: "run-1",
      status: "processing",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/support/inbound",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"externalId":"web-1"'),
      }),
    );
  });

  it("uses the documented list envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ cases: [] }), { status: 200 }),
        ),
    );

    await expect(listCases()).resolves.toEqual({
      cases: [],
    });
  });

  it("invalidates only the expired captured session after a 401", async () => {
    const expiredSession: SupportSession = {
      token: "expired-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      principal: {
        id: "customer-alex",
        email: "alex@example.com",
        tenantId: "local-demo",
        roles: ["customer"],
      },
    };
    const currentOtherTabSession = { ...expiredSession, token: "new-token" };
    const storage = new Map<string, string>([
      ["support-demo:session", JSON.stringify(currentOtherTabSession)],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );

    await expect(listCases(expiredSession)).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(storage.get("support-demo:session")).toBe(
      JSON.stringify(currentOtherTabSession),
    );
  });

  it("requires a matching role before a mounted session can enter a surface", () => {
    const customerSession = {
      token: "customer-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      principal: {
        id: "customer-alex",
        email: "alex@example.com",
        tenantId: "local-demo",
        roles: ["customer"],
      },
    } satisfies SupportSession;

    expect(hasAnyRole(customerSession, ["customer"])).toBe(true);
    expect(hasAnyRole(customerSession, ["approver", "admin"])).toBe(false);
  });
});
