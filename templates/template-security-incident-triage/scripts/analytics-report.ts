import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createReadOnlyLibSqlOperationalStore } from '../src/db/libsql-operational-store.js';
import { DuckDbAnalyticsStore } from '../src/analytics/duckdb-store.js';
import { exportAnalytics } from '../src/analytics/store.js';
import { analyticsReport, ReviewedEscalationSchema } from '../src/analytics/report.js';

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      analytics: { type: 'string' },
      output: { type: 'string' },
      tenant: { type: 'string' },
      labels: { type: 'string' },
    },
  });
  if (!values.input || !values.analytics || !values.output || !values.tenant?.trim())
    throw new Error(
      'Usage: analytics:report -- --input <existing operational.db> --analytics <derived.duckdb> --output <new report.json> --tenant <tenant> [--labels <reviewed.json>]',
    );
  const inputPath = await realpath(resolve(values.input));
  const inputStat = await stat(inputPath);
  if (!inputStat.isFile()) throw new Error('INPUT_MUST_BE_FILE');
  const analyticsPath = resolve(values.analytics);
  const outputPath = resolve(values.output);
  if (new Set([inputPath, analyticsPath, outputPath]).size !== 3) throw new Error('PATHS_MUST_BE_DISTINCT');
  const existingAnalytics = await stat(analyticsPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (existingAnalytics && existingAnalytics.dev === inputStat.dev && existingAnalytics.ino === inputStat.ino)
    throw new Error('PATHS_MUST_BE_DISTINCT');
  const labels = values.labels
    ? ReviewedEscalationSchema.array().parse(JSON.parse(await readFile(values.labels, 'utf8')))
    : [];
  const source = createReadOnlyLibSqlOperationalStore({
    url: pathToFileURL(inputPath).href,
  });
  let analytics: DuckDbAnalyticsStore | undefined;
  try {
    analytics = await DuckDbAnalyticsStore.open(analyticsPath);
    const exported = await exportAnalytics(source, analytics, values.tenant);
    const report = analyticsReport(
      values.tenant,
      await analytics.observations(exported.sourceId, values.tenant),
      labels,
    );
    await writeFile(outputPath, JSON.stringify({ ...report, export: exported }, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(`Analytics report written: ${outputPath}\n`);
  } finally {
    analytics?.close();
    source.close();
  }
}

main().catch(() => {
  process.stderr.write(
    'Analytics report failed. Check explicit paths, tenant, migration v5, labels and exclusive output path.\n',
  );
  process.exitCode = 1;
});
