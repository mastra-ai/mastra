// Splits the monorepo E2E suite across CI jobs by `describe` block. Each block builds and starts
// its own app in `beforeAll`, so a block stays whole on one shard; Vitest's `-t` filter skips the
// blocks (and their `beforeAll`) that a shard doesn't run.
//
// The last shard runs everything the named groups don't, so a new block or test file is never
// left out. Groups are balanced by how long each block took in CI (about 100 s per group).
//
// Usage: node shards.cjs <shard>  prints the `-t` pattern for that shard (1-based).
//        node shards.cjs count    prints the number of shards.

const GROUPS = [
  ['dev', 'dev Ctrl-C', 'dev --root', 'build'],
  [
    'start',
    'build without externals',
    'deployer module aliases',
    'bundler options with file-based agents',
    'Studio control route authentication',
  ],
  ['workspace subpath externals', 'Browser stream route authentication'],
];

const escape = name => name.replace(/[.[\]{}()*+?\\^$|]/g, '\\$&');
// Vitest matches `-t` against the full name, "<package manager> monorepo > <block> > <test>".
// Ending each block with " > " keeps "build" from also claiming "build without externals".
const blocks = names => `monorepo > (?:${names.map(escape).join('|')}) > `;

function patternFor(shard) {
  if (shard >= 1 && shard <= GROUPS.length) return blocks(GROUPS[shard - 1]);
  if (shard === GROUPS.length + 1) return `^(?!.*${blocks(GROUPS.flat())})`;
  throw new Error(`No monorepo E2E shard ${shard}; there are ${GROUPS.length + 1}.`);
}

module.exports = { GROUPS, patternFor, shardCount: GROUPS.length + 1 };

if (require.main === module) {
  const arg = process.argv[2];
  process.stdout.write(arg === 'count' ? String(GROUPS.length + 1) : patternFor(Number(arg)));
}
