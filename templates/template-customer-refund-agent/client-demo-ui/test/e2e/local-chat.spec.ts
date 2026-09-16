import { expect, test } from "@playwright/test";

const port = Number(
  process.env.DEMO_LOCAL_E2E_PORT ??
    Number(process.env.DEMO_E2E_PORT ?? "4300") + 1,
);
test.use({ baseURL: `http://127.0.0.1:${port}` });
async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill("customer@example.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in to your account" }).click();
  await page.getByRole("button", { name: "Chat with support" }).click();
}

test("renders local history as text, retries the same event, and sends edited content as a new event", async ({
  page,
}) => {
  const vendorRequests: string[] = [];
  page.on("request", (request) => {
    if (/intercom|stripe/.test(request.url()))
      vendorRequests.push(request.url());
  });
  await page.route("**/chat/history", (route) =>
    route.fulfill({
      json: {
        customerId: "customer-e2e",
        status: "waiting_approval",
        messages: [
          {
            author: "agent",
            body: '<img src=x onerror="window.chatXss=true">',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  const deliveries: Array<{ eventId: string; body: string }> = [];
  await page.route("**/chat/messages", (route) => {
    deliveries.push(route.request().postDataJSON());
    return route.fulfill({
      status: deliveries.length < 3 ? 503 : 200,
      json:
        deliveries.length < 3
          ? { error: "Please retry" }
          : { status: "processing" },
    });
  });
  await login(page);
  await expect(page.locator(".local-chat-messages")).toContainText(
    "<img src=x",
  );
  await expect(page.locator(".local-chat-messages img")).toHaveCount(0);
  await expect(page.locator(".local-chat-status")).toContainText(
    "waiting approval",
  );
  await page
    .getByLabel("Message", { exact: true })
    .fill("Could you check this duplicate charge?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Please retry");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => deliveries.length).toBe(2);
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeEnabled();
  expect(deliveries[1]).toEqual(deliveries[0]);
  await page
    .getByLabel("Message", { exact: true })
    .fill("I also have a question about the next invoice.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => deliveries.length).toBe(3);
  expect(deliveries[2]!.eventId).not.toBe(deliveries[0]!.eventId);
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.locator(".local-chat-panel")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Chat with support" }),
  ).toBeFocused();
  expect(vendorRequests).toEqual([]);
});

test("clears the old account before rendering a changed session's history", async ({
  page,
}) => {
  let wrongAccount = false;
  await page.route("**/chat/history", (route) =>
    route.fulfill({
      json: {
        customerId: wrongAccount ? "different-customer" : "customer-e2e",
        messages: [
          {
            author: "agent",
            body: wrongAccount
              ? "PRIVATE OTHER CUSTOMER TEXT"
              : "Current conversation",
          },
        ],
      },
    }),
  );
  await login(page);
  await expect(page.locator(".local-chat-messages")).toContainText(
    "Current conversation",
  );
  wrongAccount = true;
  await page.getByRole("button", { name: "Close chat" }).click();
  await page.getByRole("button", { name: "Chat with support" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText("PRIVATE OTHER CUSTOMER TEXT")).toHaveCount(0);
});
