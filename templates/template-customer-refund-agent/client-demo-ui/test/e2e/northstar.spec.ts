import { expect, test } from "@playwright/test";

async function installWidgetStub(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const calls = JSON.parse(
      sessionStorage.getItem("northstar-widget-calls") ?? "[]",
    ) as string[];
    const demoWindow = window as typeof window & {
      Intercom: (command: string) => void;
      northstarWidgetCalls: string[];
    };
    demoWindow.Intercom = (command: string) => {
      calls.push(command);
      sessionStorage.setItem("northstar-widget-calls", JSON.stringify(calls));
    };
    demoWindow.northstarWidgetCalls = calls;
  });
}

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to your account" }).click();
}

test("public support launcher requires login and then shows the customer account", async ({
  page,
}) => {
  await installWidgetStub(page);
  await page.goto("/atendimento");
  await expect(
    page.getByRole("heading", { name: "Sign in to track your requests." }),
  ).toBeVisible();
  await page.getByLabel("Email").fill("customer@example.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in to your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, E2E Customer." }),
  ).toBeVisible();
  await expect(page.getByText("Northstar Toolkit")).toBeVisible();
  await expect(
    page.getByText(
      "We could not retrieve your requests right now. Try again shortly.",
    ),
  ).toBeVisible();
  const initialWidgetCalls = await page.evaluate(
    () =>
      (window as typeof window & { northstarWidgetCalls: string[] })
        .northstarWidgetCalls,
  );
  await page.evaluate(() => fetch("/solicitacoes", { cache: "no-store" }));
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { northstarWidgetCalls: string[] })
          .northstarWidgetCalls,
    ),
  ).toEqual(initialWidgetCalls);
  await page.getByRole("link", { name: "Contact support" }).click();
  await expect(page).toHaveURL(/\/conta\?chat=open$/);
  await expect(
    page.getByRole("heading", { name: "Hello, E2E Customer." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { northstarWidgetCalls: string[] })
          .northstarWidgetCalls,
    ),
  ).toContain("show");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to track your requests." }),
  ).toBeVisible();
});

test("shuts down the old Messenger session after another account signs in", async ({
  page,
}) => {
  await installWidgetStub(page);
  await signIn(page, "customer@example.test", "test-password");
  await expect(page.getByText("Hello, E2E Customer.")).toBeVisible();

  const other = await page.context().newPage();
  await installWidgetStub(other);
  await signIn(other, "other@example.test", "other-test-password");
  await expect(other.getByText("Hello, Alternate Customer.")).toBeVisible();
  const otherCalls = await other.evaluate(
    () =>
      (window as typeof window & { northstarWidgetCalls: string[] })
        .northstarWidgetCalls,
  );
  expect(otherCalls.indexOf("shutdown")).toBeGreaterThanOrEqual(0);
  expect(otherCalls.indexOf("shutdown")).toBeLessThan(
    otherCalls.indexOf("boot"),
  );
  await page.waitForURL(/\/entrar$/);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { northstarWidgetCalls: string[] })
          .northstarWidgetCalls,
    ),
  ).toContain("shutdown");
});

test("shuts down the Messenger before redirecting after an expired session check", async ({
  page,
}) => {
  await installWidgetStub(page);
  await page.route("**/sessao", (route) =>
    route.fulfill({ status: 401, body: "Session expired." }),
  );
  await signIn(page, "customer@example.test", "test-password");
  await expect(page.getByText("Hello, E2E Customer.")).toBeVisible();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForURL(/\/entrar$/);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { northstarWidgetCalls: string[] })
          .northstarWidgetCalls,
    ),
  ).toContain("shutdown");
});

test("shuts down the Messenger at the exact session-expiry timer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    const demoWindow = window as typeof window & {
      northstarExpiry?: () => void;
    };
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...arguments_: unknown[]
    ) => {
      if (typeof handler === "function" && Number(timeout) > 60_000) {
        demoWindow.northstarExpiry = () => handler(...arguments_);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(handler, timeout, ...arguments_);
    }) as typeof window.setTimeout;
  });
  await installWidgetStub(page);
  await signIn(page, "customer@example.test", "test-password");
  await expect(page.getByText("Hello, E2E Customer.")).toBeVisible();
  await page.evaluate(() => {
    (
      window as typeof window & { northstarExpiry?: () => void }
    ).northstarExpiry?.();
  });
  await page.waitForURL(/\/entrar$/);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { northstarWidgetCalls: string[] })
          .northstarWidgetCalls,
    ),
  ).toContain("shutdown");
});

test("queues boot and open commands while the real Messenger loader is pending", async ({
  page,
}) => {
  await page.route("https://widget.intercom.io/widget/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.northstarQueued=window.Intercom.q.map(function(command){return command[0]});window.Intercom=function(){};",
    }),
  );
  await signIn(page, "customer@example.test", "test-password");
  await page.getByRole("link", { name: "Contact support" }).click();
  await expect(page).toHaveURL(/\/conta\?chat=open$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { northstarQueued?: string[] })
            .northstarQueued,
      ),
    )
    .toEqual(["boot", "show"]);
});
