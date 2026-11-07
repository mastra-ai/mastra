// Splits the affected unit test files across CI shards by how long each file took last time.
//
// Vitest's own --shard sorts files by a hash of their path and gives each shard the same number
// of files, so a shard that draws the slow files finishes minutes after the others. Here every
// file gets a cost (its recorded duration plus a per-file start-up cost, or an estimate when it
// has no record), the shard count follows from the total cost, and files go slowest first to the
// least-loaded shard. One job computes the plan and hands each shard its list, so the shards
// never have to agree on anything.

const { readFileSync } = require('node:fs');

// Start-up cost of a test file on a CI runner (module import, transform and environment), on top
// of its test time. Measured on a 4 vCPU StarSling runner: a 2,944-file run spent about 97
// CPU-minutes outside tests, about 2 s per file.
const FILE_OVERHEAD_MS = 2_000;
// A file with no recorded duration. Most files are fast, so this sits near the median.
const UNKNOWN_FILE_MS = 1_500;

/**
 * Duration per file path from a timings map. Keys are either a plain path or `project|path`
 * (the same file can run in several Vitest projects, so its durations add up).
 */
function durationsByFile(timings) {
  const byFile = new Map();
  for (const [key, ms] of Object.entries(timings ?? {})) {
    const file = key.includes('|') ? key.slice(key.indexOf('|') + 1) : key;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) continue;
    byFile.set(file, (byFile.get(file) ?? 0) + ms);
  }
  return byFile;
}

/** Simulated wall time of one shard: Vitest hands the next file to the first free worker. */
function shardWallMs(costs, workers) {
  const loads = new Array(Math.max(1, workers)).fill(0);
  for (const cost of [...costs].sort((a, b) => b - a)) {
    let min = 0;
    for (let i = 1; i < loads.length; i++) if (loads[i] < loads[min]) min = i;
    loads[min] += cost;
  }
  return Math.max(...loads);
}

/**
 * @param {object} options
 * @param {string[]} options.files Test files to run, as repository-relative paths.
 * @param {Record<string, number>} [options.timings] Recorded test time per file in ms.
 * @param {number} [options.maxShards] Upper bound on the shard count.
 * @param {number} [options.targetShardMs] Aim for each shard to take about this long.
 * @param {number} [options.workers] Vitest workers per shard (the runner's vCPUs).
 * @returns {{ shards: string[][], estimatedMs: number[] }}
 */
function planShards({ files, timings, maxShards = 12, targetShardMs = 150_000, workers = 4 }) {
  const unique = [...new Set(files.filter(Boolean))].sort();
  if (unique.length === 0) return { shards: [], estimatedMs: [] };

  const recorded = durationsByFile(timings);
  const cost = file => (recorded.has(file) ? recorded.get(file) : UNKNOWN_FILE_MS) + FILE_OVERHEAD_MS;
  // Slowest first; the path breaks ties so the plan is the same on every run.
  const ordered = unique
    .map(file => ({ file, cost: cost(file) }))
    .sort((a, b) => b.cost - a.cost || (a.file < b.file ? -1 : 1));

  const total = ordered.reduce((sum, item) => sum + item.cost, 0);
  const count = Math.max(1, Math.min(maxShards, unique.length, Math.ceil(total / workers / targetShardMs)));

  const shards = Array.from({ length: count }, () => ({ load: 0, files: [], costs: [] }));
  for (const item of ordered) {
    let target = shards[0];
    for (const shard of shards) if (shard.load < target.load) target = shard;
    target.load += item.cost;
    target.files.push(item.file);
    target.costs.push(item.cost);
  }

  return {
    shards: shards.map(shard => shard.files.sort()),
    estimatedMs: shards.map(shard => Math.round(shardWallMs(shard.costs, workers))),
  };
}

module.exports = { planShards, durationsByFile, shardWallMs, FILE_OVERHEAD_MS, UNKNOWN_FILE_MS };

// CLI: node test-shards.cjs <file-list> <out-dir> [timings.json]
// Writes <out-dir>/shard-<n>.txt per shard and prints the shard numbers as a JSON array.
if (require.main === module) {
  const { mkdirSync, writeFileSync, existsSync } = require('node:fs');
  const { join } = require('node:path');
  const [listPath, outDir, timingsPath] = process.argv.slice(2);
  if (!listPath || !outDir) {
    console.error('Usage: node test-shards.cjs <file-list> <out-dir> [timings.json]');
    process.exit(2);
  }
  const files = readFileSync(listPath, 'utf8').split(/\r?\n/).filter(Boolean);
  let timings = {};
  if (timingsPath && existsSync(timingsPath)) {
    try {
      timings = JSON.parse(readFileSync(timingsPath, 'utf8'));
    } catch {
      console.error(`Could not read ${timingsPath}; planning without timings.`);
    }
  }
  const env = name => (process.env[name] ? Number(process.env[name]) : undefined);
  const plan = planShards({
    files,
    timings,
    maxShards: env('TEST_SHARDS_MAX'),
    targetShardMs: env('TEST_SHARDS_TARGET_MS'),
    workers: env('TEST_SHARDS_WORKERS'),
  });
  mkdirSync(outDir, { recursive: true });
  plan.shards.forEach((shardFiles, i) =>
    writeFileSync(join(outDir, `shard-${i + 1}.txt`), `${shardFiles.join('\n')}\n`),
  );
  plan.estimatedMs.forEach((ms, i) =>
    console.error(`Shard ${i + 1}: ${plan.shards[i].length} files, about ${(ms / 60_000).toFixed(1)} min`),
  );
  process.stdout.write(JSON.stringify(plan.shards.map((_, i) => i + 1)));
}
