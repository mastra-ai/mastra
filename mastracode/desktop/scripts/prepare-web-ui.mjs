import { cp, rm, stat } from 'node:fs/promises';

const packageRoot = new URL('../', import.meta.url);
const source = new URL('../web/src/mastra/public/ui/', packageRoot);
const target = new URL('dist/web-ui/', packageRoot);

async function assertFile(url, label) {
  try {
    const info = await stat(url);
    if (info.isFile()) return;
  } catch {
    // Fall through to the error below.
  }
  throw new Error(`Missing ${label}: ${url.pathname}`);
}

await assertFile(new URL('index.html', source), 'built MastraCode web UI');
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
await assertFile(new URL('index.html', target), 'copied MastraCode web UI');
