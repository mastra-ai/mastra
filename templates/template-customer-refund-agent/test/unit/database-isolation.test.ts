import { describe, expect, it } from "vitest";
import { intercomDevelopmentConfig } from "../../src/mastra/providers/intercom/config";

const intercomEnvironment = [
  "INTERCOM_DEVELOPMENT_ENABLED",
  "INTERCOM_TENANT_ID",
  "INTERCOM_APP_ID",
  "INTERCOM_ACCESS_TOKEN",
  "INTERCOM_CLIENT_SECRET",
  "INTERCOM_ADMIN_ID",
  "INTERCOM_API_BASE_URL",
  "INTERCOM_KNOWLEDGE_ENABLED",
  "INTERCOM_TICKET_TYPE_ID",
  "INTERCOM_TICKET_STATE_ID",
];

describe("ordinary test environment isolation", () => {
  it("selects mock support and clears inherited Intercom configuration", () => {
    expect(process.env.SUPPORT_SOURCE).toBe("mock");
    expect(intercomDevelopmentConfig()).toBeUndefined();
    for (const name of intercomEnvironment)
      expect(process.env[name]).toBeUndefined();
  });
});
