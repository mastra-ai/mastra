import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { deterministicOpenAI } from "../fixtures/openai-server.ts";
import { workspaceSchema } from "../../src/workspace/contracts.ts";

const locationSchema = z.object({ directory: z.string() });
let launcher: ChildProcess | undefined;
let output = "";
const agentPort = 4134,
  webPort = 3134;
async function stop() {
  const child = launcher;
  launcher = undefined;
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}
async function ready(url: string) {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(url)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 60000, message: output.slice(-2000) },
    )
    .toBe(200);
}
function start(directory: string, env: Record<string, string>, command = "dev") {
  output = "";
  launcher = spawn("npm", ["run", command], {
    cwd: directory,
    env: {
      ...process.env,
      OPENAI_API_KEY: "synthetic-local-provider",
      AGENT_PORT: String(agentPort),
      WEB_PORT: String(webPort),
      ...env,
    },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  launcher.stdout?.on("data", (chunk) => {
    output += String(chunk);
  });
  launcher.stderr?.on("data", (chunk) => {
    output += String(chunk);
  });
}
test.afterEach(stop);
test("standalone_template_runs_grounded_workspace", async ({ page }, testInfo) => {
  const { directory } = locationSchema.parse(
    JSON.parse(await readFile(".data/standalone.json", "utf8")),
  );
  await mkdir(join(directory, ".data"), { recursive: true });
  const data = await mkdtemp(join(directory, ".data", "standalone-proof-"));
  const provider = deterministicOpenAI();
  await new Promise<void>((resolve) => provider.server.listen(0, "127.0.0.1", resolve));
  const address = provider.server.address();
  if (!address || typeof address === "string") throw new Error();
  const env = { DATA_DIRECTORY: data, ANALYSIS_BASE_URL: `http://127.0.0.1:${address.port}/v1` };
  try {
    start(directory, { ...env, OPENAI_API_KEY: "" });
    await expect.poll(() => launcher?.exitCode).not.toBeNull();
    expect(output).toContain("Set OPENAI_API_KEY");
    for (const invalid of [
      { SOURCE_ID: "missing-source" },
      { UI_COMPONENT_IDS: "missing-component" },
    ]) {
      start(directory, { ...env, ...invalid });
      await expect.poll(() => launcher?.exitCode).not.toBeNull();
      expect(output).toMatch(/Source.*unavailable|UI_COMPONENT_IDS/);
    }
    const conflict = (await import("node:net")).createServer();
    await new Promise<void>((resolve) => conflict.listen(agentPort, "127.0.0.1", resolve));
    start(directory, env);
    await expect.poll(() => launcher?.exitCode).not.toBeNull();
    expect(output).toContain("Local port");
    await new Promise<void>((resolve) => conflict.close(() => resolve()));
    start(directory, env);
    await ready(`http://127.0.0.1:${agentPort}/workspace`);
    await ready(`http://127.0.0.1:${webPort}`);
    const discovery = await fetch(`http://127.0.0.1:${agentPort}/api/agents`);
    expect(await discovery.text()).toContain("Data Explorer");
    expect((await fetch(`http://127.0.0.1:${agentPort}/api/workflows`)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${agentPort}/api/tools`)).status).toBe(200);
    const studio = await fetch(`http://127.0.0.1:${agentPort}/`);
    expect(studio.status).toBe(200);
    expect(await studio.text()).toContain("<html");
    const studioPage = await page.context().newPage();
    await studioPage.goto(`http://127.0.0.1:${agentPort}/agents`);
    await expect(studioPage.getByText("Data Explorer", { exact: true }).first()).toBeVisible();
    await studioPage.screenshot({ path: testInfo.outputPath("native-studio.png"), fullPage: true });
    await studioPage.close();
    for (const path of [
      "/api/agents/data-explorer/generate",
      "/api/agents/data-explorer/stream",
      "/api/workflows/groundedAnalysis/start",
      "/api/tools/analyze/execute",
      "/api/memory/threads",
      "/api/memory/threads/local-thread/messages",
      "/api/observability/traces",
    ]) {
      const response = await fetch(`http://127.0.0.1:${agentPort}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(response.status).toBe(403);
    }
    for (const path of [
      "/api/auth/credentials/sign-up",
      "/api/auth/credentials/sign-in",
      "/api/auth/logout",
      "/api/auth/refresh",
    ]) {
      const response = await fetch(`http://127.0.0.1:${agentPort}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "synthetic@example.test",
          password: "synthetic-password",
          name: "Synthetic",
        }),
      });
      expect(response.status).toBe(404);
    }
    await page.goto(`http://127.0.0.1:${webPort}`);
    const saved = async () => {
      const response = await page.request.get(`http://127.0.0.1:${webPort}/api/workspace`);
      const body = z.object({ workspace: workspaceSchema }).parse(await response.json());
      return body.workspace;
    };
    for (const [index, question] of [
      "Show monthly bookings",
      "Show ranked segment bookings",
      "Inspect final month records",
    ].entries()) {
      const input = page.getByPlaceholder("Ask about Sales…");
      await input.fill(question);
      await input.press("Enter");
      await expect
        .poll(async () => (await saved()).revision, { message: output.slice(-2000) })
        .toBe(index + 1);
    }
    const workspace = await saved();
    expect(workspace.components.map((item) => item.component)).toEqual(["line", "bar", "table"]);
    await expect(page.getByRole("img", { name: /Monthly bookings/ })).toBeVisible();
    await expect(page.getByRole("table").last()).toBeVisible();
    const db = new DatabaseSync(join(data, "sales.sqlite"), { readOnly: true });
    const result = db
      .prepare(
        "SELECT SUM(h.value_cents) AS total FROM opportunity_history h WHERE h.stage='won' AND h.effective_at>=? AND h.effective_at<?",
      )
      .get(workspace.source.coverage!.start, workspace.source.coverage!.end);
    db.close();
    expect(workspace.results[0]?.data.value).toBe(result?.total);
    const checksum = workspace.source.datasetVersion;
    await expect
      .poll(async () => {
        const diagnostics = new DatabaseSync(join(data, "telemetry.sqlite"), { readOnly: true });
        const count = diagnostics
          .prepare(
            "SELECT COUNT(*) AS n FROM diagnostic_events WHERE json_extract(json,'$.type')='render-ack'",
          )
          .get()?.n;
        diagnostics.close();
        return count;
      })
      .toBe(3);
    await page.screenshot({
      path: testInfo.outputPath("standalone-workspace.png"),
      fullPage: true,
    });
    const cancelAfterRead = async (workspace: z.infer<typeof workspaceSchema>) => {
      const cancellation = new AbortController();
      const cancelledRequest = `native-cancel-${Date.now()}`;
      const question = `Cancel monthly bookings ${cancelledRequest}`;
      const interrupted = fetch(`http://127.0.0.1:${agentPort}/copilotkit/agent/dataExplorer/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: cancellation.signal,
        body: JSON.stringify({
          threadId: "local-thread",
          runId: cancelledRequest,
          messages: [
            ...workspace.messages,
            { id: cancelledRequest, role: "user", content: question },
          ],
          state: {},
          tools: [],
          context: [],
          forwardedProps: { baseRevision: workspace.revision },
        }),
      })
        .then(async (response) => {
          await response.text();
        })
        .catch(() => {});
      await expect
        .poll(() =>
          provider.stages.some((stage) => stage.question === question && stage.tools === 1),
        )
        .toBe(true);
      cancellation.abort();
      await interrupted;
      await expect
        .poll(async () => {
          const journal = new DatabaseSync(join(data, "telemetry.sqlite"), { readOnly: true });
          const rows = journal
            .prepare(
              "SELECT json FROM diagnostic_events WHERE json_extract(json,'$.requestId')=? AND json_extract(json,'$.type')='analysis-end'",
            )
            .all(cancelledRequest);
          journal.close();
          return rows.map((row) =>
            typeof row.json === "string" ? JSON.parse(row.json).status : "",
          );
        })
        .toEqual(["cancelled"]);
      expect((await saved()).revision).toBe(workspace.revision);
    };
    await cancelAfterRead(workspace);
    const oversized = await fetch(`http://127.0.0.1:${agentPort}/render-ack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) }),
    });
    expect(oversized.status).toBe(413);
    const calls = provider.calls.length;
    await stop();
    for (const port of [agentPort, webPort])
      await expect
        .poll(async () => {
          try {
            await fetch(`http://127.0.0.1:${port}`);
            return false;
          } catch {
            return true;
          }
        })
        .toBe(true);
    start(directory, env, "start");
    await ready(`http://127.0.0.1:${agentPort}/workspace`);
    await ready(`http://127.0.0.1:${webPort}`);
    page = await page.context().newPage();
    await page.goto(`http://127.0.0.1:${webPort}`);
    await expect(page.getByText("Revision 3", { exact: false }).first()).toBeVisible();
    expect((await saved()).source.datasetVersion).toBe(checksum);
    expect(provider.calls.length).toBe(calls);
    await page.getByPlaceholder("Ask about Sales…").fill("Show monthly bookings");
    await page.getByPlaceholder("Ask about Sales…").press("Enter");
    await expect.poll(async () => (await saved()).revision).toBe(4);
    await cancelAfterRead(await saved());
    await page
      .getByPlaceholder("Ask about Sales…")
      .fill("Show a customer retention cohort heatmap");
    await page.getByPlaceholder("Ask about Sales…").press("Enter");
    await expect.poll(async () => (await saved()).revision).toBe(5);
    const heatmap = page.locator('[data-component="heatmap"]');
    await expect(heatmap.getByRole("img")).toBeVisible();
    await expect(heatmap.locator(".echart svg")).toBeVisible();
    expect(
      (await saved()).results.find((result) => result.data.metric === "cohortRetention")?.data.table
        ?.kind,
    ).toBe("matrix");
    await heatmap
      .locator(".echart")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await heatmap
      .locator(".echart")
      .screenshot({ path: testInfo.outputPath("production-cohort.png") });
    await page
      .getByPlaceholder("Ask about Sales…")
      .fill("Show monthly customer churn for the last 12 complete months");
    await page.getByPlaceholder("Ask about Sales…").press("Enter");
    await expect.poll(async () => (await saved()).revision).toBe(6);
    await expect(
      page.getByRole("heading", { name: "Monthly customer churn", exact: true }),
    ).toBeVisible();
    const churn = (await saved()).results.find((result) => result.data.metric === "customerChurn");
    expect(churn?.data.table?.kind).toBe("series");
    const churnEnd = workspace.source.coverage!.end;
    const churnStart = new Date(`${churnEnd}T00:00:00Z`);
    churnStart.setUTCMonth(churnStart.getUTCMonth() - 12);
    expect(churn?.data.request.period).toEqual({
      start: churnStart.toISOString().slice(0, 10),
      end: churnEnd,
    });
    expect(churn?.data.table?.rows).toHaveLength(12);
    await stop();
    const traces = new DatabaseSync(join(data, "traces.sqlite"), { readOnly: true });
    const tables = traces
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%span%'")
      .all();
    expect(tables.length).toBeGreaterThan(0);
    const spanTable = tables.find(
      (row) => typeof row.name === "string" && row.name.includes("span"),
    );
    if (typeof spanTable?.name !== "string" || !/^[a-zA-Z_]+$/.test(spanTable.name))
      throw new Error("Missing span table.");
    const spans = traces.prepare(`SELECT * FROM ${spanTable.name}`).all();
    traces.close();
    expect(spans.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(spans);
    expect(serialized).not.toContain("synthetic-local-provider");
    expect(serialized).not.toContain("Show monthly bookings");
    expect(serialized).not.toContain("Opportunity records");
    await writeFile(
      testInfo.outputPath("native-startup.json"),
      JSON.stringify(
        {
          source: workspace.source,
          revision: workspace.revision,
          providerCalls: provider.calls.length,
          restoredWithoutReplay: true,
          builtQueryAndCancellation: true,
          nativeSpanCount: spans.length,
          cleanShutdown: true,
          builtStart: true,
          nativeCancellation: true,
          uploadLimitBytes: 2 * 1024 * 1024,
        },
        null,
        2,
      ),
    );
  } finally {
    await stop();
    await new Promise<void>((resolve) => provider.server.close(() => resolve()));
  }
});
