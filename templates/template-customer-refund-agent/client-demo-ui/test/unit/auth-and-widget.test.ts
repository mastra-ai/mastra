import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  issueBackendBridge,
  issueMessengerJwt,
  verifyBridgeForTest,
} from "../../src/bridge.js";
import { databaseUrl, ensureDatabaseDirectory } from "../../src/db.js";

const customer = {
  id: "customer-example",
  name: "Example Customer",
  email: "customer@example.test",
  tenantId: "local-demo",
  stripeCustomerId: "cus_example",
  intercomContactId: "contact_example",
};

describe("demo identity tokens", () => {
  it("uses the isolated local client database by default", () => {
    const previous = process.env.DEMO_DATABASE_URL;
    delete process.env.DEMO_DATABASE_URL;
    expect(databaseUrl()).toContain(".data/local-demo-client.db");
    if (previous === undefined) delete process.env.DEMO_DATABASE_URL;
    else process.env.DEMO_DATABASE_URL = previous;
  });
  it("creates a fresh configured database parent before the client opens it", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "northstar-demo-db-"));
    const database = join(temporary, "new-parent", "demo.db");
    try {
      await ensureDatabaseDirectory(`file:${database}`);
      expect(existsSync(dirname(database))).toBe(true);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
  it("does not issue a backend assertion when the bridge secret is unavailable", () => {
    delete process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY;
    expect(
      issueBackendBridge(customer, new Date(Date.now() + 1_000).toISOString()),
    ).toBeUndefined();
  });
  it("binds the backend assertion to the stable demo customer", () => {
    process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY =
      "test-demo-bridge-signing-key-with-at-least-32-chars";
    const token = issueBackendBridge(
      customer,
      new Date(Date.now() + 1_000).toISOString(),
    )!;
    expect(
      verifyBridgeForTest(token, process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY),
    ).toBe(true);
    expect(Buffer.from(token.split(".")[0]!, "base64url").toString()).toContain(
      "contact_example",
    );
  });
  it("creates a short-lived Messenger JWT with only the required customer identity claims", () => {
    process.env.INTERCOM_MESSENGER_JWT_SECRET = "messenger-secret";
    const jwt = issueMessengerJwt(customer, "2030-01-01T00:00:00.000Z")!;
    const claims = JSON.parse(
      Buffer.from(jwt.split(".")[1]!, "base64url").toString(),
    );
    expect(claims.user_id).toBe("customer-example");
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "user_id"]);
    expect(JSON.stringify(claims)).not.toContain("contact_example");
    expect(jwt.split(".")).toHaveLength(3);
    expect(claims.exp).toBe(
      Math.floor(Date.parse("2030-01-01T00:00:00.000Z") / 1_000),
    );
  });
});
