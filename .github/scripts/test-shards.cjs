// Shard math for the affected unit tests, shared by select-affected-tests.cjs (how many shards)
// and scripts/vitest-timing-sequencer.ts (which files each `vitest --shard=k/N` run takes).
//
// Vitest's own --shard sorts files by a hash of their path and gives each shard the same number
// of files, so a shard that draws the slow files finishes minutes after the others. Here every
// file gets a cost (its recorded duration plus a per-file start-up cost, or an estimate when it
// has no record), the shard count follows from the total cost, and files go slowest first to the
// least-loaded shard.

// Start-up cost of a test file on a CI runner (module import, transform and environment), on top
// of its test time. Measured on a 4 vCPU StarSling runner: a 2,944-file run spent about 97
// CPU-minutes outside tests, about 2 s per file.
const FILE_OVERHEAD_MS = 2_000;
// A file with no recorded duration. Most files are fast, so this sits near the median.
const UNKNOWN_FILE_MS = 1_500;

/**
 * Cost per file path from a timings map. Keys are either a plain path or `project|path` (the same
 * file can run in several Vitest projects, so its durations add up).
 */
function fileCosts(timings) {
  const recorded = new Map();
  for (const [key, ms] of Object.entries(timings ?? {})) {
    const file = key.includes('|') ? key.slice(key.indexOf('|') + 1) : key;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) continue;
    recorded.set(file, (recorded.get(file) ?? 0) + ms);
  }
  return file => (recorded.get(file) ?? UNKNOWN_FILE_MS) + FILE_OVERHEAD_MS;
}

/**
 * How many shards a list of test files needs: enough for each to take about `targetShardMs` with
 * `workers` Vitest workers, at most `maxShards`.
 */
function shardCount({ files, timings, maxShards = 16, targetShardMs = 150_000, workers = 4 }) {
  const unique = new Set(files.filter(Boolean));
  if (unique.size === 0) return 0;
  const cost = fileCosts(timings);
  let total = 0;
  for (const file of unique) total += cost(file);
  return Math.max(1, Math.min(maxShards, unique.size, Math.ceil(total / workers / targetShardMs)));
}

/**
 * Splits files across `count` shards, slowest first onto the least-loaded shard. Files with the
 * same `groupOf` key stay on one shard. The result only depends on the set of files, so every
 * shard computes the same plan.
 * @returns {{ shards: string[][], loads: number[] }}
 */
function assignShards({ files, timings, count, groupOf = () => undefined }) {
  const cost = fileCosts(timings);
  // A unit is a single file, or every file of a group, placed on a shard together.
  const units = new Map();
  for (const file of [...new Set(files.filter(Boolean))].sort()) {
    const group = groupOf(file);
    const key = group === undefined ? `file:${file}` : `group:${group}`;
    const unit = units.get(key) ?? { key, files: [], cost: 0 };
    unit.files.push(file);
    unit.cost += cost(file);
    units.set(key, unit);
  }
  // Slowest first; the key breaks ties so the plan is the same on every run.
  const ordered = [...units.values()].sort((a, b) => b.cost - a.cost || (a.key < b.key ? -1 : 1));

  const shards = Array.from({ length: Math.max(1, count) }, () => ({ load: 0, files: [] }));
  for (const unit of ordered) {
    let target = shards[0];
    for (const shard of shards) if (shard.load < target.load) target = shard;
    target.load += unit.cost;
    target.files.push(...unit.files);
  }
  return { shards: shards.map(shard => shard.files.sort()), loads: shards.map(shard => shard.load) };
}

module.exports = { shardCount, assignShards, FILE_OVERHEAD_MS, UNKNOWN_FILE_MS };
