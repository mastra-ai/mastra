import { access, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createDistributableSnapshot } from "./distributable-snapshot.mjs";

const source = resolve(process.argv[2] || process.cwd());
const { destination, fingerprint } = await createDistributableSnapshot(
  source,
  "support-refund-clean-snapshot-",
);
const localSigningKey = "clean-clone-smoke-signing-key-at-least-32-characters";
const firstPrompt = "Check ORD-1001 and summarize the evidence.";
const firstAnswer =
  "ORD-1001 is fulfilled. This was a read-only investigation.";
const followUpPrompt = "Confirm the safe outcome.";
const followUpAnswer = "Follow-up completed with the same read-only case.";
const childDatabaseCandidates = [
  "mastra.db",
  "src/mastra/public/.data/local-demo.db",
  ".mastra/output/.data/local-demo.db",
  "src/mastra/public/mastra.db",
  ".mastra/output/mastra.db",
];

const run = (command, args, cwd, env) => {
  console.log(`[smoke] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 900_000,
    killSignal: "SIGTERM",
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`,
    );
  return result.stdout.trim();
};

function syntheticEnvironment() {
  // Do not inherit a developer's provider selection, .env credentials, or
  // remote endpoints. PATH and npm's cache are the only host values needed by
  // this disposable, deterministic qualification.
  return {
    PATH: process.env.PATH,
    npm_config_cache: process.env.npm_config_cache,
    LOCAL_AUTH_SIGNING_KEY: localSigningKey,
    SUPPORT_SOURCE: "mock",
    COMMERCE_SOURCE: "mock",
    MASTRA_TELEMETRY_DISABLED: "1",
    NO_COLOR: "1",
  };
}

async function exists(path) {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

async function assertLocalProfileDatabase() {
  const databasePath = join(destination, ".data", "local-demo.db");
  if (!(await exists(databasePath)))
    throw new Error(
      "local:seed did not create the default local .data/local-demo.db.",
    );
  for (const childPath of childDatabaseCandidates)
    if (await exists(join(destination, childPath)))
      throw new Error(`Unexpected child-cwd database: ${childPath}.`);

  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: pathToFileURL(databasePath).href });
  try {
    const result = await client.execute({
      sql: "SELECT order_id, status FROM local_orders WHERE order_id = 'ORD-1001'",
      args: [],
    });
    const order = result.rows[0];
    if (order?.order_id !== "ORD-1001" || order.status !== "fulfilled")
      throw new Error(
        "Local .data/local-demo.db does not contain the fulfilled ORD-1001 fixture.",
      );
  } finally {
    client.close();
  }
}

async function injectStudioFixture() {
  const fixture = join(
    destination,
    "test/fixtures/native-studio-read-model.ts",
  );
  const injectedModel = join(destination, "src/mastra/studio-test-model.ts");
  await copyFile(fixture, injectedModel);
  const indexPath = join(destination, "src/mastra/index.ts");
  const index = await readFile(indexPath, "utf8");
  const injection = `\nimport { nativeStudioReadModel } from "./studio-test-model";\nmastra.getAgent("supportSupervisorAgent").__updateModel({\n  model: nativeStudioReadModel() as never,\n});\n`;
  if (index.includes("nativeStudioReadModel"))
    throw new Error(
      "Clean-clone Studio fixture injection marker already exists.",
    );
  await writeFile(indexPath, `${index}${injection}`);
}

async function waitForCompletedRun(page, answer) {
  await page.getByText(answer, { exact: true }).waitFor({ timeout: 20_000 });
  await page
    .getByPlaceholder("Enter your message...")
    .waitFor({ state: "visible", timeout: 20_000 });
  // Current Studio exposes the agent's isRunning state on the composer ring;
  // the previous visible "Idle" label is no longer part of the agent chat.
  await page
    .locator('[data-slot="composer-ring"][data-busy="false"]')
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function runStudioJourney(port) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const unexpectedFailures = [];
  const expectedAncillaryDenials = [];
  let initialThreadInspectionAvailable = true;
  const expectedDeniedStudioPaths = new Set([
    "/api/processors",
    "/api/mcp/v0/servers",
    // New Studio navigation fetches these global panels. The local demo
    // intentionally exposes only scoped support history and supervision.
    "/api/observability/feedback",
    "/api/experiments/review-summary",
    "/api/channels/platforms",
  ]);
  const isSupervisorExecution = (path, method) =>
    method === "POST" &&
    /^\/api\/agents\/support-supervisor\/(?:generate|stream|send-message|signals|threads\/subscribe)$/.test(
      path,
    );
  const isScopedMemory = (path) => path.startsWith("/api/memory/");
  const isExpectedStudioAncillaryDenial = (path, method) =>
    method === "GET" &&
    (expectedDeniedStudioPaths.has(path) ||
      path === "/api/agents/support-supervisor/voice/speakers" ||
      /^\/api\/memory\/threads\/[^/]+\/working-memory$/.test(path));
  const isInitialMissingThreadInspection = (path, method) =>
    method === "GET" && /^\/api\/memory\/threads\/[^/]+$/.test(path);
  page.on("response", (response) => {
    const url = new URL(response.url());
    const path = url.pathname;
    const method = response.request().method();
    const failure = { status: response.status(), method, url: response.url() };
    const isSignIn =
      method === "POST" && path === "/api/auth/credentials/sign-in";
    const isLogout = method === "POST" && path === "/api/auth/logout";
    if (isSignIn || isLogout) {
      unexpectedFailures.push(failure);
      return;
    }
    if (
      response.status() === 403 &&
      isExpectedStudioAncillaryDenial(path, method)
    ) {
      expectedAncillaryDenials.push(failure);
      return;
    }
    if (
      response.status() === 404 &&
      initialThreadInspectionAvailable &&
      isInitialMissingThreadInspection(path, method)
    ) {
      expectedAncillaryDenials.push(failure);
      initialThreadInspectionAvailable = false;
      return;
    }
    if (isSupervisorExecution(path, method) || isScopedMemory(path)) {
      if (response.status() !== 200) unexpectedFailures.push(failure);
      return;
    }
    if (response.status() < 400) return;
    unexpectedFailures.push(failure);
  });
  try {
    // Studio configures its API host as localhost. Keeping the browser origin
    // identical avoids a loopback cross-origin request in login-free dev mode.
    await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });
    await page
      .getByRole("link", { name: "Agents", exact: true })
      .waitFor({ timeout: 10_000 });

    await page.getByText("Support Supervisor", { exact: true }).click();
    const composer = page.getByPlaceholder("Enter your message...");
    await composer.fill(firstPrompt);
    await composer.press("Enter");
    await waitForCompletedRun(page, firstAnswer);
    // Studio can prefetch a just-created thread before its first turn is
    // durable. Once the first answer has rendered, all memory responses must
    // remain successful for the persisted-history journey below.
    initialThreadInspectionAvailable = false;
    await page.getByText("Lookup order", { exact: true }).waitFor({
      timeout: 10_000,
    });

    // The Studio keeps long-lived traffic open; the persisted-answer assertion
    // below is the journey-specific readiness signal after this reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForCompletedRun(page, firstAnswer);
    await composer.fill(followUpPrompt);
    await composer.press("Enter");
    await waitForCompletedRun(page, followUpAnswer);

    if (unexpectedFailures.length)
      throw new Error(
        `Studio browser journey had unexpected failed responses: ${JSON.stringify(unexpectedFailures)}`,
      );
    if (!expectedAncillaryDenials.length)
      throw new Error(
        "Studio browser journey did not observe the expected ancillary authorization denials.",
      );
  } finally {
    await browser.close();
  }
}

let server;
let serverOutput = "";
try {
  await writeFile(
    join(destination, ".env"),
    [
      `LOCAL_AUTH_SIGNING_KEY=${localSigningKey}`,
      "SUPPORT_SOURCE=mock",
      "COMMERCE_SOURCE=mock",
    ].join("\n"),
  );
  const env = syntheticEnvironment();
  env.LOCAL_DEMO_FIXTURE_PROFILE = "characterization";
  const e2eApiPort = await unusedPort();
  const e2ePort = await unusedPort();
  env.E2E_API_PORT = String(e2eApiPort);
  env.E2E_PORT = String(e2ePort);
  run("npm", ["ci"], destination, env);
  await injectStudioFixture();
  for (const command of [
    ["run", "check:runtime"],
    ["run", "check:env", "--", "--profile=local", "--mode=deterministic"],
    ["run", "local:seed"],
  ])
    run("npm", command, destination, env);
  await assertLocalProfileDatabase();
  for (const command of [
    ["run", "build"],
    ["run", "build:web"],
    ["run", "build:demo"],
    ["run", "test:e2e"],
  ])
    run("npm", command, destination, env);
  await assertLocalProfileDatabase();

  const port = await unusedPort();
  env.LOCAL_DEMO_BACKEND_PORT = String(port);
  server = spawn("npm", ["run", "dev"], {
    cwd: destination,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream?.on("data", (chunk) => {
      if (serverOutput.length < 12_000)
        serverOutput += chunk.toString().slice(0, 12_000 - serverOutput.length);
    });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if (server.exitCode !== null) break;
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready)
    throw new Error(`Local server did not become ready.\n${serverOutput}`);
  await runStudioJourney(port);
  await assertLocalProfileDatabase();

  const login = await fetch(`http://127.0.0.1:${port}/support/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(5_000),
    body: JSON.stringify({
      email: "alex@example.com",
      password: "local-customer-alex",
    }),
  });
  if (!login.ok) throw new Error("Local smoke authentication failed.");
  const session = await login.json().catch(() => ({}));
  if (!session || typeof session.token !== "string" || !session.token)
    throw new Error("Local smoke authentication response was invalid.");
  const openApiResponse = await fetch(
    `http://127.0.0.1:${port}/support/openapi.json`,
    {
      headers: { authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(5_000),
    },
  );
  const openApi = await openApiResponse.json().catch(() => undefined);
  if (!openApiResponse.ok || openApi?.openapi !== "3.1.0")
    throw new Error("Authenticated OpenAPI check failed.");
  console.log(
    JSON.stringify({
      status: "passed",
      fingerprint,
      database: ".data/local-demo.db",
      studio: {
        firstPrompt,
        tool: "lookup_order",
        order: "ORD-1001 fulfilled",
        reloadHistory: true,
        followUpPrompt,
        loginFreeStudio: true,
      },
    }),
  );
} finally {
  if (server?.exitCode === null) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
    const exited = new Promise((resolve) => server.once("exit", resolve));
    const terminated = await Promise.race([
      exited.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    if (!terminated && server.pid) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        server.kill("SIGKILL");
      }
      await exited;
    }
  }
  await rm(destination, { recursive: true, force: true });
}

function unusedPort() {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      listener.close((error) =>
        error
          ? reject(error)
          : resolve(address && typeof address !== "string" ? address.port : 0),
      );
    });
  });
}
