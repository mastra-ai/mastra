import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { extractionFile, isWithin, repositoryBoundary } from "../../scripts/standalone-files.ts";
import { referenceFixture } from "../fixtures/reference.ts";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.doUnmock("node:child_process");
  vi.doUnmock("../../scripts/quality/benchmark.ts");
  vi.doUnmock("../../src/observability/native.ts");
  vi.doUnmock("@mastra/libsql");
  vi.resetModules();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function scratch() {
  const directory = await mkdtemp(join(tmpdir(), "maintenance-proof-"));
  directories.push(directory);
  return directory;
}

it("extraction detects the actual Git root without rejecting common-prefix siblings", async () => {
  const root = await scratch();
  const repository = join(root, "repo");
  const template = join(repository, "templates", "example");
  await mkdir(template, { recursive: true });
  await writeFile(join(repository, ".git"), "gitdir: external-worktree-metadata");
  const boundary = repositoryBoundary(template);
  expect(boundary).toBe(repository);
  for (const path of [
    repository,
    template,
    join(repository, "packages", "out"),
    join(repository, "..output"),
  ])
    expect(isWithin(boundary, path)).toBe(true);
  for (const path of [root, join(root, "repo-copy"), join(root, "outside")])
    expect(isWithin(boundary, path)).toBe(false);
  expect(repositoryBoundary(root)).toBe(root);
  expect(extractionFile("tests/browser-app/.next")).toBe(false);
  expect(extractionFile("nested/.env.local")).toBe(false);
  expect(extractionFile(".env.example")).toBe(true);
});

it("a worker emitting repeated process errors releases its cleanup without an uncaught error", async () => {
  const child = Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    send: () => {
      queueMicrotask(() => {
        child.emit("error", new Error("Synthetic spawn error"));
        child.emit("error", new Error("Synthetic EPIPE"));
        child.emit("close", 1);
      });
    },
  });
  vi.doMock("node:child_process", () => ({ fork: () => child }));
  const { runReadProcess } = await import("../../data-sources/read-process.ts");
  const cleanups: Promise<void>[] = [];
  await expect(
    runReadProcess(
      new URL("file:///unused-worker.ts"),
      {},
      {
        signal: new AbortController().signal,
        deadline: Date.now() + 5000,
        maxRows: 10,
        maxBytes: 1000,
        requestId: "request",
        queryId: "query",
        traceId: "trace",
        trackCleanup: (promise) => {
          cleanups.push(promise);
        },
      },
    ),
  ).rejects.toMatchObject({ code: "source-unavailable" });
  await expect(Promise.all(cleanups)).resolves.toEqual([undefined]);
});

it("benchmark CLI passes strict options to the runner without making paid model calls", async () => {
  const directory = await scratch();
  referenceFixture(join(directory, "sales.sqlite")).db.close();
  for (const [key, value] of Object.entries({
    DATA_DIRECTORY: directory,
    OPENAI_API_KEY: "synthetic-test-key",
    BENCHMARK_APPROVED: "true",
    BENCHMARK_CAP_USD: "100",
    BENCHMARK_INPUT_USD_PER_MILLION: "0.4",
    BENCHMARK_OUTPUT_USD_PER_MILLION: "1.6",
    BENCHMARK_PRICING_VERSION: "synthetic-pricing",
    BENCHMARK_PRICING_MODEL: "gpt-4.1-mini",
    BENCHMARK_PRICING_VERIFIED_AT: new Date().toISOString().slice(0, 10),
    BENCHMARK_PRICING_REFERENCE: "https://openai.com/api/pricing/",
    ANALYSIS_MODEL: "gpt-4.1-mini",
  }))
    vi.stubEnv(key, value);
  const actual = await import("../../scripts/quality/benchmark.ts");
  const run = vi.fn(async (_source: unknown, _model: unknown, options: unknown) => {
    expect(actual.benchmarkOptions.parse(options)).not.toHaveProperty("calls");
    expect(actual.benchmarkBudget(options).calls).toBe(192);
    return { passed: true, totalCases: 0, skipped: [] };
  });
  vi.doMock("../../scripts/quality/benchmark.ts", () => ({ ...actual, runBenchmark: run }));
  await import("../../scripts/benchmark.ts");
  expect(run).toHaveBeenCalledOnce();
  expect(JSON.parse(await readFile(join(directory, "live-benchmark.json"), "utf8"))).toMatchObject({
    passed: true,
  });
});

it("shutdown closes every resource even after synchronous and asynchronous cleanup failures", async () => {
  const calls: string[] = [];
  vi.doMock("@mastra/libsql", () => ({
    LibSQLStore: class {
      async init() {}
      async close() {
        calls.push("trace");
      }
    },
  }));
  vi.doMock("../../src/observability/native.ts", () => ({
    localObservability: () => ({
      shutdown: async () => {
        calls.push("observability");
        throw new Error("Synthetic failure");
      },
    }),
  }));
  const callbacks: (() => void)[] = [];
  vi.spyOn(process, "once").mockImplementation(((signal: string, callback: () => void) => {
    if (signal === "SIGINT" || signal === "SIGTERM") callbacks.push(callback);
    return process;
  }) as typeof process.once);
  vi.spyOn(process, "emitWarning").mockImplementation(() => {});
  const { closeOnShutdown } = await import("../../src/mastra/lifecycle.ts");
  closeOnShutdown({
    engine: {
      close: () => {
        calls.push("engine");
        throw new Error("Synthetic failure");
      },
    },
    storage: {
      close: async () => {
        calls.push("storage");
      },
    },
    telemetry: {
      close: () => {
        calls.push("telemetry");
      },
    },
  } as unknown as Parameters<typeof closeOnShutdown>[0]);
  callbacks.forEach((callback) => callback());
  await vi.waitFor(() =>
    expect(calls).toEqual(["observability", "engine", "storage", "trace", "telemetry"]),
  );
});
