import type { AnalysisResult, DataSource } from "./source.ts";

/** Execute source-owned examples and release the selected source on every outcome. */
export async function inspectSource(source: DataSource) {
  try {
    const descriptor = source.describe();
    const results: { title: string; result: AnalysisResult }[] = [];
    for (const example of descriptor.examples) {
      results.push({ title: example.title, result: await source.execute(example.request) });
    }
    return { source: descriptor, results };
  } finally {
    await source.close();
  }
}
