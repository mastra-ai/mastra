#!/usr/bin/env node
import { isMainThread, parentPort, workerData } from 'node:worker_threads';

if (!isMainThread && workerData?.typegen === true) {
  const { generateToolTypes, TypegenError } = await import('./typegen');
  try {
    parentPort!.postMessage({ ok: true, value: await generateToolTypes(workerData.definitions) });
  } catch (error) {
    // Only the generator's own messages are safe to surface: converter failures can carry schema
    // values, so they stay generic.
    parentPort!.postMessage({ ok: false, message: error instanceof TypegenError ? error.message : undefined });
  }
} else {
  const [command, ...files] = process.argv.slice(2);
  if (command !== 'generate' || !files.length || files.some(file => file.startsWith('-'))) {
    console.error('Usage: npx @mastra/mcp generate <client-files...>');
    process.exitCode = 1;
  } else {
    try {
      const { generate } = await import('./generate');
      await generate(files);
    } catch (error) {
      // A `GenerationError` message is built from our own text plus supplied paths and server
      // names. Anything else, including a failure inside an imported application module, stays
      // generic so it cannot leak configurations or credentials into the terminal.
      console.error(
        error instanceof Error && error.name === 'GenerationError'
          ? error.message
          : 'MCP generation failed. Check client exports, output paths, server access, and schema validity. Files may be partially replaced only if a filesystem replacement fails.',
      );
      process.exitCode = 1;
    }
  }
}
