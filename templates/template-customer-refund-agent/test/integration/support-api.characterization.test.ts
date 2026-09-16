import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mastra/core/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mastra/core/llm")>();
  return {
    ...actual,
    ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {},
  };
});

import {
  supportCaseApproveRoute,
  supportCasesListRoute,
  supportInboundRoute,
} from "../../src/mastra/server/routes";
import { caseStore } from "../../src/mastra/lib/case-store";
import { issueLocalSession } from "../../src/mastra/server/auth";

afterEach(() => vi.restoreAllMocks());

function responseContext(rawBody: string, principalId = "customer-alex") {
  return {
    req: {
      raw: new Request("http://support.test", {
        headers: {
          authorization: `Bearer ${issueLocalSession({ id: principalId })}`,
        },
      }),
      text: async () => rawBody,
    },
    get: () => undefined,
    json: (body: unknown, status = 200) => ({ body, status }),
  };
}

describe("support API WIP characterization", () => {
  it("rejects malformed inbound JSON at the HTTP boundary", async () => {
    const response = await supportInboundRoute.handler(
      responseContext("{not-json") as never,
    );

    expect(response).toEqual({
      body: { error: "Invalid JSON body." },
      status: 400,
    });
  });

  it("returns the list envelope used by the demo UI", async () => {
    const response = await supportCasesListRoute.handler({
      req: {
        raw: new Request("http://support.test", {
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "customer-alex" })}`,
          },
        }),
        query: () => undefined,
      },
      json: (body: unknown, status = 200) => ({ body, status }),
    } as never);

    expect(response).toMatchObject({
      status: 200,
      body: { cases: expect.any(Array) },
    });
  });

  it("rejects malformed approval JSON before it resumes or mutates a case", async () => {
    const get = vi.spyOn(caseStore, "get").mockResolvedValue({
      id: "case-waiting",
      customer: { email: "alex@example.com" },
      status: "waiting_approval",
      workflowRunId: "run-waiting",
      metadata: { providerBinding: { tenantId: "local-demo" } },
    } as never);
    const update = vi.spyOn(caseStore, "update");
    const getMastra = vi.fn();

    const response = await supportCaseApproveRoute.handler({
      req: {
        raw: new Request("http://support.test", {
          headers: {
            authorization: `Bearer ${issueLocalSession({ id: "approver-demo" })}`,
          },
        }),
        param: () => "case-waiting",
        text: async () => "{not-json",
      },
      get: getMastra,
      json: (body: unknown, status = 200) => ({ body, status }),
    } as never);

    expect(response).toEqual({
      body: { error: "Invalid approval payload." },
      status: 400,
    });
    expect(get).toHaveBeenCalledWith("case-waiting");
    expect(update).not.toHaveBeenCalled();
    expect(getMastra).not.toHaveBeenCalled();
  });
});
