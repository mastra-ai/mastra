import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  authenticateSeededCredentials,
  canAccessCase,
  isLocalStudioDevMode,
  issueLocalSession,
  principalFromHeaders,
  studioPrincipalForRequest,
  verifyLocalSession,
} from "../../src/mastra/server/auth";
import { CaseStore } from "../../src/mastra/lib/case-store";
import { rm } from "node:fs/promises";
import { temporaryDatabasePath } from "../support/temp-path";

const previous = process.env.LOCAL_AUTH_SIGNING_KEY;
const previousAppMode = process.env.APP_MODE;
const previousMastraDev = process.env.MASTRA_DEV;
const previousMastraTelemetryCommand = process.env.MASTRA_TELEMETRY_COMMAND;
const key = "phase003-test-signing-key-must-be-at-least-32-chars";

afterEach(() => {
  if (previous === undefined) delete process.env.LOCAL_AUTH_SIGNING_KEY;
  else process.env.LOCAL_AUTH_SIGNING_KEY = previous;
  if (previousAppMode === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = previousAppMode;
  if (previousMastraDev === undefined) delete process.env.MASTRA_DEV;
  else process.env.MASTRA_DEV = previousMastraDev;
  if (previousMastraTelemetryCommand === undefined)
    delete process.env.MASTRA_TELEMETRY_COMMAND;
  else process.env.MASTRA_TELEMETRY_COMMAND = previousMastraTelemetryCommand;
});

describe("local support auth", () => {
  it("denies anonymous Studio access under exact dev flags in explicit external mode", () => {
    process.env.APP_MODE = "staging";
    process.env.MASTRA_DEV = "true";
    process.env.MASTRA_TELEMETRY_COMMAND = "dev";

    expect(isLocalStudioDevMode()).toBe(false);
    expect(
      studioPrincipalForRequest(new Request("http://localhost/api/workflows")),
    ).toBeUndefined();
  });

  it("issues an opaque session and reloads roles from the seeded identity", () => {
    process.env.LOCAL_AUTH_SIGNING_KEY = key;
    const token = authenticateSeededCredentials(
      "approver@local.test",
      "local-approver",
    );
    expect(token).toBeTruthy();
    expect(
      Buffer.from(token!.split(".")[0], "base64url").toString(),
    ).not.toContain("password");
    expect(verifyLocalSession(token!)).toMatchObject({
      id: "approver-demo",
      roles: ["approver"],
    });
  });

  it("rejects a correctly signed token that attempts to grant its own role", () => {
    process.env.LOCAL_AUTH_SIGNING_KEY = key;
    const payload = Buffer.from(
      JSON.stringify({
        id: "customer-alex",
        appMode: "local",
        roles: ["admin"],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toString("base64url");
    const token = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
    expect(verifyLocalSession(token)).toMatchObject({
      id: "customer-alex",
      roles: ["customer"],
    });
  });

  it("scopes customers by immutable owner id instead of client email", () => {
    process.env.LOCAL_AUTH_SIGNING_KEY = key;
    const alex = verifyLocalSession(
      issueLocalSession({ id: "customer-alex" }),
    )!;
    expect(
      canAccessCase(alex, {
        customer: { email: "alex@example.com" },
        metadata: {
          providerBinding: { tenantId: "local-demo" },
          ownerId: "customer-alex",
        },
      }),
    ).toBe(true);
    expect(
      canAccessCase(alex, {
        customer: { email: "alex@example.com" },
        metadata: {
          providerBinding: { tenantId: "local-demo" },
          ownerId: "customer-jordan",
        },
      }),
    ).toBe(false);
  });

  it("accepts a demo bridge only when its signature binds the exact Intercom contact", () => {
    process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY = key;
    const payload = Buffer.from(
      JSON.stringify({
        id: "demo-customer",
        appMode: "local",
        email: "customer@example.test",
        tenantId: "local-demo",
        roles: ["customer"],
        intercomContactId: "contact-stable",
        stripeCustomerId: "cus-stable",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toString("base64url");
    const token = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
    const principal = principalFromHeaders(
      new Headers({ authorization: `Bearer ${token}` }),
    )!;
    expect(
      canAccessCase(principal, {
        customer: { email: "different@example.test" },
        metadata: {
          providerBinding: { tenantId: "local-demo" },
          ownerId: "intercom:local-demo:contact:contact-stable",
        },
      }),
    ).toBe(true);
    expect(
      canAccessCase(principal, {
        customer: { email: "customer@example.test" },
        metadata: {
          providerBinding: { tenantId: "local-demo" },
          ownerId: "intercom:local-demo:contact:another-customer",
        },
      }),
    ).toBe(false);
  });
});

describe("durable follow-up turns", () => {
  it("appends one event/turn and invalidates a waiting approval", async () => {
    const path = temporaryDatabasePath("phase003-turn");
    const store = new CaseStore({ url: `file:${path}` });
    const createdAt = "2026-09-05T00:00:00.000Z";
    try {
      await store.create({
        id: "case-turn",
        externalId: "event-1",
        source: "mock-email",
        customer: { email: "alex@example.com" },
        subject: "Refund",
        messages: [
          { id: "message-1", author: "customer", body: "Refund", createdAt },
        ],
        status: "waiting_approval",
        createdAt,
        updatedAt: createdAt,
        approval: { approved: true, approverId: "approver-demo" },
        metadata: {
          providerBinding: {
            tenantId: "local-demo",
            providerKind: "local",
            providerAccountId: "local-demo",
            externalConversationId: "conversation-1",
          },
        },
      });
      const first = await store.appendFollowUp({
        caseId: "case-turn",
        eventId: "event-2",
        runId: "run-2",
        message: {
          id: "message-2",
          author: "customer",
          body: "Actually, please review again.",
          createdAt,
        },
      });
      const duplicate = await store.appendFollowUp({
        caseId: "case-turn",
        eventId: "event-2",
        runId: "run-3",
        message: {
          id: "message-3",
          author: "customer",
          body: "duplicate",
          createdAt,
        },
      });
      expect(first.appended).toBe(true);
      expect(duplicate.appended).toBe(false);
      expect((await store.get("case-turn"))!).toMatchObject({
        status: "new",
      });
      // Dispatch ownership is assigned after the route claims this pending
      // turn. Appending alone must not overwrite an in-flight run pointer.
      expect((await store.get("case-turn"))!.workflowRunId).toBeUndefined();
      expect((await store.get("case-turn"))!.approval).toBeUndefined();
    } finally {
      await store.close();
      await Promise.all([
        rm(path, { force: true }),
        rm(`${path}-shm`, { force: true }),
        rm(`${path}-wal`, { force: true }),
      ]);
    }
  });
});

it("binds staff sessions to their app mode even when signing keys are reused", () => {
  const previousMode = process.env.APP_MODE;
  try {
    process.env.LOCAL_AUTH_SIGNING_KEY = key;
    process.env.APP_MODE = "local";
    const local = issueLocalSession({ id: "approver-demo" });
    process.env.APP_MODE = "production";
    expect(verifyLocalSession(local)).toBeUndefined();
    const external = issueLocalSession({ id: "approver-demo" });
    expect(verifyLocalSession(external)).toBeDefined();
    process.env.APP_MODE = "local";
    expect(verifyLocalSession(external)).toBeUndefined();
    expect(verifyLocalSession(local)).toBeDefined();
  } finally {
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
  }
});

it("accepts legacy untagged bridge sessions only externally", async () => {
  const { verifyDemoBridgeSession } =
    await import("../../src/mastra/server/auth");
  const previousMode = process.env.APP_MODE;
  const previousBridge = process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY;
  try {
    process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY = key;
    const payload = Buffer.from(
      JSON.stringify({
        id: "legacy",
        email: "legacy@example.test",
        tenantId: "local-demo",
        roles: ["customer"],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toString("base64url");
    const token = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
    delete process.env.APP_MODE;
    expect(verifyDemoBridgeSession(token)).toBeUndefined();
    process.env.APP_MODE = "staging";
    expect(verifyDemoBridgeSession(token)).toMatchObject({ id: "legacy" });
  } finally {
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousBridge === undefined)
      delete process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY;
    else process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY = previousBridge;
  }
});
