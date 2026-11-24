import { inspectSource } from "../data-sources/inspect.ts";
import { openDataSource } from "../data-sources/registry.ts";
import type { SourceSettings } from "../data-sources/source.ts";
import { defaultSourceId, prepareSource, sources } from "./sources.ts";

const [command, ...args] = process.argv.slice(2);
try {
  if (command !== "init" && command !== "inspect")
    throw new Error(
      "Use npm run data:init or npm run data:inspect, optionally followed by -- --source <id> --path <file>.",
    );
  let sourceId = defaultSourceId;
  const settings: Record<string, string> = {};
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !value || !["--source", "--path"].includes(key) || seen.has(key))
      throw new Error("Expected unique --source <id> and/or --path <file> options.");
    seen.add(key);
    if (key === "--source") sourceId = value;
    else settings.path = value;
  }
  const configuration: SourceSettings = settings;
  if (command === "init") {
    await prepareSource(sources, sourceId, configuration);
    const source = await openDataSource(sources, sourceId, configuration);
    try {
      console.log(JSON.stringify({ source: source.describe() }, null, 2));
    } finally {
      await source.close();
    }
  } else {
    const source = await openDataSource(sources, sourceId, configuration);
    console.log(JSON.stringify(await inspectSource(source), null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Data-source command failed.");
  process.exitCode = 1;
}
