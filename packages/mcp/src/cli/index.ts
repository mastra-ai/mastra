#!/usr/bin/env node
import { isMainThread, parentPort, workerData } from 'node:worker_threads';

if (!isMainThread && workerData?.typegen === true) {
  try {
    const { generateToolTypes } = await import('./typegen');
    parentPort!.postMessage({ ok: true, value: await generateToolTypes(workerData.definitions) });
  } catch {
    parentPort!.postMessage({ ok: false });
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
    } catch {
      console.error(
        'MCP generation failed. Check client exports, output paths, server access, and schema validity. Files may be partially replaced only if a filesystem replacement fails.',
      );
      process.exitCode = 1;
    }
  }
}
