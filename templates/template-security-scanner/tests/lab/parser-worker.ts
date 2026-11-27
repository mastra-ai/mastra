import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathSchema } from '../../src/core/contracts.js';
import { DiscoveryParser, SecretGuard } from '../../src/discovery/parser.js';

const started = performance.now();
const guard = new SecretGuard([]);
const parser = new DiscoveryParser(
  {
    entryUrl: 'https://example.test/',
    approvedOrigins: ['https://example.test'],
    allowedPaths: ['/'],
    excludedPaths: [],
  },
  { id: randomUUID(), role: 'public' },
  'http',
  guard,
  () => {},
);
const hostile = ['/' + 'a'.repeat(120) + '!', '/' + 'a'.repeat(509) + '!', '/a/'.repeat(100) + '!'];
let rejected = 0;
for (const path of hostile) {
  if (!pathSchema.safeParse(path).success) rejected++;
  parser.feed('stdout', JSON.stringify({ request: { endpoint: path, method: 'GET' } }) + '\n');
}
parser.feed('stdout', JSON.stringify({ request: { endpoint: '/catalog.json', method: 'GET' } }) + '\n');
const result = parser.finish();
const controller = new AbortController();
await new Promise<void>(resolve =>
  setTimeout(() => {
    controller.abort();
    resolve();
  }, 10),
);
console.log(
  JSON.stringify({
    rejected,
    cleanRecord: result.observations.some(item => item.path === '/catalog.json'),
    cancelResponsive: controller.signal.aborted,
    elapsedMs: performance.now() - started,
  }),
);
