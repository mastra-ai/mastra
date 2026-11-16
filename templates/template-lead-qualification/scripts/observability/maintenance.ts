import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { DuckDBStore } from '@mastra/duckdb';
import { createApplicationRuntime } from '../../src/mastra/application';
import { runtimeConfig } from '../../src/mastra/config/runtime';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import { LeadMaintenance, maintenancePreviewSchema } from '../../src/mastra/observability/maintenance';

const { values } = parseArgs({ options: { preview: { type: 'string' }, apply: { type: 'string' } } });
if (Boolean(values.preview) === Boolean(values.apply))
  throw new Error('Choose --preview <file.json> or --apply <file.json>. Stop the application first.');
const runtime = runtimeConfig();
// Acquire the native cross-process DuckDB lock before touching operational state.
// An active application owns this file: native initialization fails before any LibSQL mutation.
const lock = new DuckDBStore({
  id: 'maintenance-lock',
  path: runtime.observabilityPath,
  memoryLimit: '512MB',
  threads: 2,
});
await lock.init();
try {
  const app = await createApplicationRuntime({ runtime });
  try {
    const maintenance = new LeadMaintenance(app.storage, app.outputs, qualificationConfig.retention);
    if (values.preview) {
      const preview = await maintenance.preview({ now: new Date().toISOString() });
      await writeFile(values.preview, JSON.stringify(preview, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.info(JSON.stringify(preview));
    } else {
      const preview = maintenancePreviewSchema.parse(JSON.parse(await readFile(values.apply!, 'utf8')));
      console.info(JSON.stringify(await maintenance.apply(preview)));
    }
  } finally {
    await app.storage.close();
    await app.telemetry.observability.shutdown();
  }
} finally {
  await lock.close();
}
