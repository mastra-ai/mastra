import { expect, test } from "@playwright/test";
import { serve } from "@hono/node-server";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { Hono } from "hono";
import { RequestContext } from "@mastra/core/request-context";
import {
  deterministicJsonModel,
  deterministicRefundModel,
  type DeterministicRefundModel,
} from "../fixtures/deterministic-language-model";
import { temporaryDatabasePath } from "../support/temp-path";

const e2eApiPort = Number(process.env.E2E_API_PORT ?? "4111");
type Runtime = Awaited<ReturnType<typeof loadDeterministicRuntime>>;

async function loadDeterministicRuntime() {
  const databasePath = temporaryDatabasePath("phase008-admin-e2e");
  process.env.APP_MODE = "local";
  process.env.ORIGINAL_DATABASE_URL = `file:${databasePath}.external`;
  process.env.ORIGINAL_DEMO_DATABASE_URL = `file:${databasePath}.external-client`;
  process.env.LOCAL_DEMO_CLIENT_DATABASE_URL = `file:${databasePath}.client`;
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.LOCAL_DEMO_DATABASE_URL = `file:${databasePath}`;
  process.env.SUPPORT_SOURCE = "mock";
  process.env.COMMERCE_SOURCE = "mock";
  process.env.LOCAL_AUTH_SIGNING_KEY =
    "phase008-playwright-signing-key-must-be-at-least-32-characters";
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  const { mastra, shutdownLocalMastra } =
    await import("../../src/mastra/index");
  const { caseStore } = await import("../../src/mastra/lib/case-store");
  mastra.getAgent("triageAgent").__updateModel({
    model: deterministicJsonModel({
      intent: "duplicate_charge",
      urgency: "normal",
      sentiment: "negative",
      requiresHumanReview: false,
      confidence: 1,
      rationale: "Deterministic browser triage.",
    }) as never,
  });
  mastra.getAgent("responseAgent").__updateModel({
    model: deterministicJsonModel({
      draftResponse: "A deterministic refund response.",
      citedSources: ["duplicate-charge-policy"],
      selectedPolicyExcerpts: [
        {
          source: "duplicate-charge-policy",
          excerpt:
            "If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**.",
        },
      ],
      recommendRefund: true,
      refundAmount: 20,
      refundCurrency: "USD",
      refundReason: "duplicate charge",
      requiresEscalation: false,
    }) as never,
  });
  const refundModels = new Map<string, DeterministicRefundModel>();
  mastra.getAgent("refundExecutionAgent").__updateModel({
    model: async () => {
      const action = await caseStore
        .getClient()
        .execute(
          "SELECT data FROM support_actions WHERE kind = 'refund-command' ORDER BY created_at DESC LIMIT 1",
        );
      const command = JSON.parse(String(action.rows[0]?.data ?? "{}")) as {
        approvalCaseId: string;
        orderId: string;
        amount: { minor: number; currency: string };
        reason: string;
        idempotencyKey: string;
        fingerprint: string;
      };
      let model = refundModels.get(command.fingerprint);
      if (!model) {
        model = deterministicRefundModel({
          caseId: command.approvalCaseId,
          orderId: command.orderId,
          amount: command.amount.minor / 100,
          currency: command.amount.currency,
          reason: command.reason,
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
        });
        refundModels.set(command.fingerprint, model);
      }
      return model;
    },
  });
  return { caseStore, databasePath, mastra, shutdownLocalMastra };
}

async function startSupportApi(runtime: Runtime) {
  const routes = await import("../../src/mastra/server/routes");
  const app = new Hono();
  app.use("/support/*", async (c, next) => {
    const requestContext = new RequestContext();
    c.set("mastra", runtime.mastra);
    c.set("requestContext", requestContext);
    await next();
  });
  app.post("/support/auth/login", routes.supportLoginRoute.handler);
  app.post("/support/inbound", routes.supportInboundRoute.handler);
  app.get("/support/cases", routes.supportCasesListRoute.handler);
  app.get("/support/cases/:caseId", routes.supportCaseDetailRoute.handler);
  app.post(
    "/support/cases/:caseId/approve",
    routes.supportCaseApproveRoute.handler,
  );
  app.get(
    "/support/monitoring/summary",
    routes.supportMonitoringSummaryRoute.handler,
  );
  const server = serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: e2eApiPort,
  });
  if (!server.listening) await once(server, "listening");
  return () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
}

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await expect(page.getByText("Sign in to the local demo")).toBeVisible();
  await page.locator("#session-email").fill(email);
  await page.locator("#session-password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("keeps the local admin approval UI after the customer portal is removed", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runtime = await loadDeterministicRuntime();
  const stopServer = await startSupportApi(runtime);
  try {
    const login = await fetch(
      `http://127.0.0.1:${e2eApiPort}/support/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "alex@example.com",
          password: "local-customer-alex",
        }),
      },
    );
    const { token } = (await login.json()) as { token: string };
    const created = await fetch(
      `http://127.0.0.1:${e2eApiPort}/support/inbound`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          externalId: "phase008-admin-approval",
          from: "alex@example.com",
          subject: "Approve this synthetic refund",
          body: "Please refund the duplicate charge for ORD-1001.",
        }),
      },
    );
    const { caseId } = (await created.json()) as { caseId: string };
    await expect
      .poll(async () => (await runtime.caseStore.get(caseId))?.status)
      .toBe("waiting_approval");
    await page.goto("/admin");
    await signIn(page, "approver@local.test", "local-approver");
    await expect(page.getByText("Support admin")).toBeVisible();
    await page
      .getByRole("button", { name: "Approve this synthetic refund" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/${caseId}$`));
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Conversation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "AI Analysis" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Order & policy data" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await page
      .getByRole("button", { name: "Approve this synthetic refund" })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await expect(
      page.getByRole("tab", { name: "Order & policy data" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByText("Refund approval requested")).toBeVisible();
    await page.route(`**/support/cases/${caseId}/approve`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Authentication required." }),
      }),
    );
    await page.getByRole("button", { name: "Approve refund" }).click();
    await expect(page.getByText("Sign in to the local demo")).toBeVisible();
    expect(await runtime.caseStore.approvalDecision(caseId)).toBeUndefined();
    await page.unroute(`**/support/cases/${caseId}/approve`);
    await signIn(page, "approver@local.test", "local-approver");
    await expect(page).toHaveURL(new RegExp(`/admin/${caseId}$`));
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Approve refund" }).click();
    await expect(page.getByText("Refund approved")).toBeVisible();
    await expect
      .poll(async () => (await runtime.caseStore.get(caseId))?.status)
      .toBe("resolved");
    const effects = await runtime.caseStore
      .getClient()
      .execute(
        "SELECT COUNT(*) AS count FROM local_refunds WHERE tenant_id = ? AND provider_account_id = ?",
        ["local-demo", "local-demo"],
      );
    expect(Number(effects.rows[0]?.count)).toBe(1);

    const createCreditCase = async (subject: string, externalId: string) => {
      const response = await fetch(
        `http://127.0.0.1:${e2eApiPort}/support/inbound`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            externalId,
            from: "alex@example.com",
            subject,
            body: "Please refund the duplicate charge for ORD-1001.",
          }),
        },
      );
      return (await response.json()) as { caseId: string };
    };
    const firstCredit = await createCreditCase(
      "Confirm reported service problem A",
      "phase008-credit-approval-a",
    );
    const secondCredit = await createCreditCase(
      "Confirm reported service problem B",
      "phase008-credit-approval-b",
    );
    await expect
      .poll(
        async () => (await runtime.caseStore.get(firstCredit.caseId))?.status,
      )
      .toBe("waiting_approval");
    await expect
      .poll(
        async () => (await runtime.caseStore.get(secondCredit.caseId))?.status,
      )
      .toBe("waiting_approval");
    const makeCreditApprovalVisible = async (
      creditCaseId: string,
      subject: string,
      fingerprint: string,
    ) => {
      const current = await runtime.caseStore.get(creditCaseId);
      if (!current) throw new Error("Expected synthetic approval case.");
      await runtime.caseStore.update(creditCaseId, {
        subject,
        draft: {
          draftResponse:
            "A future billing credit can be proposed after an approver confirms the reported service problem.",
          citedSources: ["service-problem-credit-policy"],
          selectedPolicyExcerpts: [],
          recommendRefund: false,
          resolutionAction: "subscription_credit",
          subscriptionCreditAmount: 49,
          subscriptionCreditCurrency: "USD",
          subscriptionCreditReason:
            "Reported service problem pending human confirmation",
          requiresEscalation: false,
        },
        metadata: {
          ...current.metadata,
          refundCommand: undefined,
          subscriptionCreditCommand: {
            approvalCaseId: creditCaseId,
            customerId: "local:local-demo:alex@example.com",
            subscriptionId: "SUB-1001",
            amount: 49,
            currency: "USD",
            reason: "Reported service problem pending human confirmation",
            idempotencyKey: `e2e-credit-${fingerprint}`,
            fingerprint,
          },
        },
      });
    };
    await makeCreditApprovalVisible(
      firstCredit.caseId,
      "Confirm reported service problem A",
      "credit-fingerprint-a",
    );
    await makeCreditApprovalVisible(
      secondCredit.caseId,
      "Confirm reported service problem B",
      "credit-fingerprint-b",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("button", { name: "Confirm reported service problem A" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm reported service problem A" })
      .click();
    const confirmation = page.getByRole("checkbox", {
      name: "I confirm the reported service problem before approving this credit.",
    });
    const approveCredit = page.getByRole("button", {
      name: "Approve credit",
    });
    await expect(confirmation).not.toBeChecked();
    await expect(approveCredit).toBeDisabled();
    await confirmation.check();
    await expect(approveCredit).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("button", { name: "Confirm reported service problem B" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm reported service problem B" })
      .click();
    await expect(confirmation).not.toBeChecked();
    await expect(approveCredit).toBeDisabled();
  } finally {
    await stopServer();
    await runtime.shutdownLocalMastra();
    await Promise.all(
      [
        runtime.databasePath,
        `${runtime.databasePath}-shm`,
        `${runtime.databasePath}-wal`,
      ].map((path) => rm(path, { force: true })),
    );
  }
});
