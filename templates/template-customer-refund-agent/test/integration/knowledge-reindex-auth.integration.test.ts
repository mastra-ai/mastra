import { RequestContext } from "@mastra/core/request-context";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { issueLocalSession } from "../../src/mastra/server/auth";
import { supportKnowledgeReindexRoute } from "../../src/mastra/server/routes";

describe("knowledge reindex authorization", () => {
  it("denies a foreign-tenant principal before it can start the registered workflow", async () => {
    const createRun = vi.fn();
    const app = new Hono();
    app.use("/support/*", async (c, next) => {
      c.set("mastra", { getWorkflow: () => ({ createRun }) } as never);
      c.set("requestContext", new RequestContext());
      await next();
    });
    app.post(
      "/support/knowledge/reindex",
      supportKnowledgeReindexRoute.handler,
    );
    const response = await app.request("/support/knowledge/reindex", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueLocalSession({ id: "other-tenant-agent" })}`,
      },
    });
    expect(response.status).toBe(403);
    expect(createRun).not.toHaveBeenCalled();
  });
});
