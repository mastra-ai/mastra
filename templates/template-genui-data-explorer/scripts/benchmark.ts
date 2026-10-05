import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { openDataSource } from "../data-sources/registry.ts";
import { sources, defaultSourceId } from "../data-sources/sources.ts";
import { benchmarkBudget, BenchmarkModel, runBenchmark } from "./quality/benchmark.ts";

const budget = benchmarkBudget({
  approved: process.env.BENCHMARK_APPROVED === "true",
  capUsd: Number(process.env.BENCHMARK_CAP_USD),
  inputUsdPerMillion: Number(process.env.BENCHMARK_INPUT_USD_PER_MILLION),
  outputUsdPerMillion: Number(process.env.BENCHMARK_OUTPUT_USD_PER_MILLION),
  pricingVersion: process.env.BENCHMARK_PRICING_VERSION,
  pricingModel: process.env.BENCHMARK_PRICING_MODEL,
  pricingVerifiedAt: process.env.BENCHMARK_PRICING_VERIFIED_AT,
  pricingReference: process.env.BENCHMARK_PRICING_REFERENCE,
  model: process.env.ANALYSIS_MODEL ?? "gpt-4.1-mini",
});
if (!process.env.OPENAI_API_KEY)
  throw new Error("Set the server model credential before the explicitly approved benchmark.");
const directory = resolve(process.env.DATA_DIRECTORY ?? ".data");
const source = await openDataSource(sources, defaultSourceId, {
  path: resolve(directory, "sales.sqlite"),
});
try {
  const model = new BenchmarkModel({ providerId: "openai", modelId: budget.model }, budget);
  const report = await runBenchmark(source, model, budget);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "live-benchmark.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      passed: report.passed,
      executed: report.totalCases,
      skipped: report.skipped.length,
      report: "live-benchmark.json",
    }),
  );
  if (!report.passed) process.exitCode = 1;
} finally {
  await source.close();
}
