// Turns a Vitest JSON report into the per-file timings that test-shards.cjs plans with.
//
// The output maps a repository-relative test file to the summed duration of its tests in ms.
// Previous timings are kept for files this report did not run, so an affected-only run refreshes
// what it ran without forgetting the rest.
//
// Usage: node test-timings.cjs <vitest-report.json> <timings.json> [previous-timings.json]

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { relative, resolve } = require('node:path');

function timingsFromReport(report, root) {
  const timings = {};
  for (const file of report?.testResults ?? []) {
    if (typeof file?.name !== 'string') continue;
    const path = relative(root, resolve(root, file.name)).split('\\').join('/');
    if (path.startsWith('..')) continue;
    const ms = (file.assertionResults ?? []).reduce(
      (sum, test) => sum + (Number.isFinite(test?.duration) ? test.duration : 0),
      0,
    );
    // A file can run in several Vitest projects; its cost on a shard is the sum.
    timings[path] = Math.round((timings[path] ?? 0) + ms);
  }
  return timings;
}

function readJson(path) {
  if (!path || !existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

module.exports = { timingsFromReport };

if (require.main === module) {
  const [reportPath, outPath, previousPath] = process.argv.slice(2);
  if (!reportPath || !outPath) {
    console.error('Usage: node test-timings.cjs <vitest-report.json> <timings.json> [previous-timings.json]');
    process.exit(2);
  }
  const report = readJson(reportPath);
  if (!report) {
    console.error(`No readable report at ${reportPath}; leaving timings unchanged.`);
    process.exit(0);
  }
  const fresh = timingsFromReport(report, process.cwd());
  const merged = { ...(readJson(previousPath) ?? {}), ...fresh };
  writeFileSync(outPath, JSON.stringify(merged));
  console.error(
    `Timings for ${Object.keys(fresh).length} files from this run, ${Object.keys(merged).length} in total.`,
  );
}
