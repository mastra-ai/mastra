import { expect, test } from "@playwright/test";
import { serve } from "@hono/node-server";
import { once } from "node:events";
import { Hono } from "hono";

const apiPort = Number(process.env.E2E_API_PORT ?? "4111");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function supportCase(id: string, subject: string) {
  return {
    id,
    externalId: `event-${id}`,
    source: "intercom-conversation",
    customer: { email: `${id}@example.test`, name: `Customer ${id}` },
    subject,
    messages: [
      {
        id: `message-${id}`,
        author: "customer",
        body: `Question for ${id}`,
        createdAt: "2026-09-11T12:00:00.000Z",
      },
    ],
    status: "escalated",
    createdAt: "2026-09-11T12:00:00.000Z",
    updatedAt: "2026-09-11T12:00:00.000Z",
    metadata: {},
  };
}

async function navigateWithinAdmin(
  page: import("@playwright/test").Page,
  path: string,
) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** Wait until a fulfilled API promise has had a chance to commit React state
 * and paint. The assertion below must observe the post-handler modal, not the
 * already-rendered B screen that existed before the stale response released. */
async function waitForResponseRender(page: import("@playwright/test").Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function watchForStaleReceipt(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.staleManualReceipt = "false";
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Manual resolution recorded"))
        document.documentElement.dataset.staleManualReceipt = "true";
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

test("keeps case B manual context when case A POST or 409 refresh resolves late", async ({
  page,
}) => {
  const caseA = supportCase("case-a", "Case A");
  const caseB = supportCase("case-b", "Case B");
  const firstPostReached = deferred<void>();
  const firstPostResponse = deferred<Response>();
  const secondPostReached = deferred<void>();
  const secondPostResponse = deferred<Response>();
  const delayedARefreshReached = deferred<void>();
  const delayedARefreshResponse = deferred<Response>();
  let postCount = 0;
  let delayARefresh = false;
  const app = new Hono();
  app.post("/support/auth/login", (c) =>
    c.json({
      token: "manual-race-session",
      expiresAt: "2030-01-01T00:00:00.000Z",
      principal: {
        id: "support-agent-race",
        email: "support@example.test",
        tenantId: "local-demo",
        roles: ["support-agent"],
      },
    }),
  );
  app.get("/support/cases", (c) => c.json({ cases: [caseA, caseB] }));
  app.get("/support/cases/:caseId/manual-resolution", async (c) => {
    const caseId = c.req.param("caseId");
    if (caseId === caseA.id && delayARefresh) {
      delayedARefreshReached.resolve();
      return await delayedARefreshResponse.promise;
    }
    return c.json({
      version: caseId === caseA.id ? 1 : 2,
      activeTurnId: caseId === caseA.id ? "turn-a" : "turn-b",
    });
  });
  app.post("/support/cases/:caseId/manual-resolution", async (c) => {
    if (c.req.param("caseId") !== caseA.id)
      return c.json({ error: "unexpected case" }, 400);
    postCount += 1;
    if (postCount === 1) {
      firstPostReached.resolve();
      return await firstPostResponse.promise;
    }
    secondPostReached.resolve();
    return await secondPostResponse.promise;
  });
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
    await page.goto("/admin");
    await page.locator("#session-email").fill("support@example.test");
    await page.locator("#session-password").fill("synthetic-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Case A" }).click();
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-a/);
    await page.locator("#manual-note").fill("A delayed resolution");
    await page.getByRole("button", { name: "Record note and close" }).click();
    await firstPostReached.promise;

    await navigateWithinAdmin(page, "/admin/case-b");
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-b/);
    const firstResponseObserved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/support/cases/case-a/manual-resolution") &&
        response.status() === 200,
    );
    await watchForStaleReceipt(page);
    firstPostResponse.resolve(
      Response.json({
        case: { ...caseA, status: "resolved" },
        context: {
          version: 2,
          activeTurnId: "turn-a",
          receipt: {
            id: "receipt-a",
            actorId: "support-agent-race",
            turnId: "turn-a",
            createdAt: "2026-09-11T12:01:00.000Z",
            noteState: "pending",
            closeState: "pending",
          },
        },
        replayed: false,
      }),
    );
    await firstResponseObserved;
    await waitForResponseRender(page);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.staleManualReceipt,
        ),
      )
      .toBe("false");
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-b/);
    await expect(page.getByText("Manual resolution recorded")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Record note and close" }),
    ).toBeVisible();

    await navigateWithinAdmin(page, "/admin/case-a");
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-a/);
    await page.locator("#manual-note").fill("A conflict refresh");
    delayARefresh = true;
    await page.getByRole("button", { name: "Record note and close" }).click();
    await secondPostReached.promise;
    secondPostResponse.resolve(
      Response.json({ error: "Manual resolution conflict." }, { status: 409 }),
    );
    await delayedARefreshReached.promise;
    await navigateWithinAdmin(page, "/admin/case-b");
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-b/);
    const refreshResponseObserved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/support/cases/case-a/manual-resolution") &&
        response.status() === 200,
    );
    await watchForStaleReceipt(page);
    delayedARefreshResponse.resolve(
      Response.json({
        version: 3,
        activeTurnId: "turn-a",
        receipt: {
          id: "receipt-a-refresh",
          actorId: "support-agent-race",
          turnId: "turn-a",
          createdAt: "2026-09-11T12:02:00.000Z",
          noteState: "delivered",
          closeState: "delivered",
        },
      }),
    );
    await refreshResponseObserved;
    await waitForResponseRender(page);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.staleManualReceipt,
        ),
      )
      .toBe("false");
    await expect(page.getByRole("dialog")).toHaveText(/Support Case: case-b/);
    await expect(page.getByText("Manual resolution recorded")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Record note and close" }),
    ).toBeVisible();
  } finally {
    await stop();
  }
});
