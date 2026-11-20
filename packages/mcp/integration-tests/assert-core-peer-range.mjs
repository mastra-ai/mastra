// The consumers install the E2E registry's `0.0.0-e2e-test-*` core, which is outside published
// MCP 1.x's `@mastra/core` peer range, so published-v1/run.sh allows that one peer edge. This
// keeps the guarantee that edge used to give: this checkout's real core version must still fit the
// range that the installed @mastra/mcp declares.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const consumer = process.argv[2];
if (!consumer) {
  console.error('Usage: node assert-core-peer-range.mjs <consumer dir>');
  process.exit(2);
}

const semver = createRequire(new URL('../package.json', import.meta.url))('semver');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

const mcp = readJson(join(consumer, 'node_modules/@mastra/mcp/package.json'));
const range = mcp.peerDependencies?.['@mastra/core'];
const coreVersion = readJson(new URL('../../core/package.json', import.meta.url)).version;

if (!range) {
  console.error(`@mastra/mcp@${mcp.version} does not declare a @mastra/core peer range`);
  process.exit(1);
}
// pnpm matches peer ranges with prereleases included, so an alpha core counts as in range.
if (!semver.satisfies(coreVersion, range, { includePrerelease: true })) {
  console.error(`@mastra/core@${coreVersion} does not satisfy @mastra/mcp@${mcp.version}'s peer range "${range}"`);
  process.exit(1);
}
console.log(`@mastra/core@${coreVersion} satisfies @mastra/mcp@${mcp.version}'s peer range "${range}"`);
