import { expect, test } from "@playwright/test";
import { serve } from "@hono/node-server";
import { once } from "node:events";
import { Hono } from "hono";

const apiPort = Number(process.env.E2E_API_PORT ?? "4111");

const caseId = "admin-tabs-case";
const subject = "A compact dialog subject";
const summary = {
  generatedAt: "2026-09-11T12:00:00.000Z",
  casesConsidered: 1,
  funnel: {
    totalCases: 1,
    new: 0,
    processing: 0,
    waitingApproval: 0,
    resolved: 0,
    escalated: 1,
    failed: 0,
    containmentRate: 0,
    escalationRate: 1,
    avgResolutionMinutes: null,
  },
  refunds: {
    recommended: 0,
    approved: 0,
    rejected: 0,
    autoEscalated: 0,
    executed: 0,
    failed: 0,
    approvalRate: null,
    executedTotals: [],
  },
  feedback: {
    up: 0,
    down: 0,
    totalResponses: 0,
    satisfactionRate: null,
    recent: [],
  },
  telemetry: {
    unavailable: [],
    modelUsage: [
      {
        model: "synthetic-model",
        inputTokens: 10,
        outputTokens: 5,
        estimatedCostMicrosUsd: 3,
      },
    ],
    workflowStages: [
      { operation: "triage", calls: 1, errorRate: 0, p95Ms: 15 },
    ],
    providerCalls: [],
    toolCalls: [],
    providerOrToolErrorRate: 0,
    providerOrToolP95Ms: 15,
    alerts: [],
  },
  failures: {
    rejectedDecisions: 0,
    workflow: 0,
    financial: 0,
    delivery: 0,
  },
};

const supportCase = {
  id: caseId,
  externalId: "event-admin-tabs",
  source: "intercom-conversation",
  customer: {
    email: "customer-with-a-long-identifier@example.synthetic.test",
    name: "Synthetic Customer",
  },
  subject,
  messages: [
    {
      id: "message-admin-tabs",
      author: "customer",
      body: "A synthetic request for the layout test.",
      createdAt: "2026-09-11T12:00:00.000Z",
    },
  ],
  status: "escalated",
  triage: {
    intent: "duplicate_charge",
    urgency: "normal",
    sentiment: "negative",
    requiresHumanReview: true,
    confidence: 0.9,
    rationale: "Synthetic triage.",
  },
  createdAt: "2026-09-11T12:00:00.000Z",
  updatedAt: "2026-09-11T12:00:00.000Z",
  metadata: {},
};

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.locator("#session-email").fill(email);
  await page.locator("#session-password").fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("separates admin views while retaining the case deep link and compact dialog header", async ({
  page,
}) => {
  const app = new Hono();
  app.post("/support/auth/login", async (c) => {
    const { email } = await c.req.json<{ email: string }>();
    const isAdmin = email === "admin@example.test";
    return c.json({
      token: `session-${isAdmin ? "admin" : "approver"}`,
      expiresAt: "2030-01-01T00:00:00.000Z",
      principal: {
        id: isAdmin ? "admin" : "approver",
        email,
        tenantId: "local-demo",
        roles: [isAdmin ? "admin" : "approver"],
      },
    });
  });
  app.get("/support/cases", (c) => c.json({ cases: [supportCase] }));
  app.get("/support/monitoring/summary", (c) => c.json(summary));

  const server = serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: apiPort,
  });
  if (!server.listening) await once(server, "listening");
  const stop = () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );

  try {
    await page.goto(`/admin/${caseId}`);
    await signIn(page, "admin@example.test");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Support Case: ${caseId}`);
    await expect(dialog).toContainText("Synthetic Customer");
    await expect(dialog).toContainText("via intercom-conversation");
    await expect(dialog).not.toContainText(subject);
    await page.setViewportSize({ width: 390, height: 844 });
    const close = dialog.locator('[data-slot="dialog-close"]');
    const status = dialog.getByText("Escalated", { exact: true });
    const closeBox = await close.boundingBox();
    const statusBox = await status.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(closeBox!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin$/);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(
      page.getByRole("tab", { name: "Cases", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tab", { name: "Monitoring", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Telemetry", exact: true }),
    ).toBeVisible();

    const escalatedFilter = page.getByRole("tab", {
      name: "Escalated",
      exact: true,
    });
    await escalatedFilter.click();
    const casesTab = page.getByRole("tab", { name: "Cases", exact: true });
    const monitoringTab = page.getByRole("tab", {
      name: "Monitoring",
      exact: true,
    });
    const telemetryTab = page.getByRole("tab", {
      name: "Telemetry",
      exact: true,
    });
    await casesTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(monitoringTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(monitoringTab).toHaveAttribute("aria-selected", "true");
    const monitoringPanelId = await monitoringTab.getAttribute("aria-controls");
    expect(monitoringPanelId).toBeTruthy();
    const monitoringPanel = page.locator(`#${monitoringPanelId}`);
    await expect(monitoringPanel).toContainText("Case funnel");
    await expect(
      page.getByRole("heading", { name: "Monitoring" }),
    ).toBeVisible();
    await expect(page.getByText("Case funnel")).toBeVisible();
    await expect(page.getByText("Operational telemetry")).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(telemetryTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(telemetryTab).toHaveAttribute("aria-selected", "true");
    const telemetryPanelId = await telemetryTab.getAttribute("aria-controls");
    expect(telemetryPanelId).toBeTruthy();
    await expect(page.locator(`#${telemetryPanelId}`)).toContainText(
      "Operational telemetry",
    );
    await expect(
      page.getByRole("heading", { name: "Telemetry" }),
    ).toBeVisible();
    await expect(page.getByText("Operational telemetry")).toBeVisible();
    await expect(page.getByText("Case funnel")).toBeHidden();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/${caseId}$`));
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Support Case: ${caseId}`);
    await page.goForward();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Telemetry" }),
    ).toBeVisible();

    await casesTab.click();
    await expect(escalatedFilter).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "More admin actions" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await signIn(page, "approver@example.test");
    await expect(
      page.getByRole("tab", { name: "Cases", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Monitoring", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("tab", { name: "Telemetry", exact: true }),
    ).toBeHidden();
  } finally {
    await stop();
  }
});
