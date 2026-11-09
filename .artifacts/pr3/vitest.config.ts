import { defineConfig } from 'vitest/config';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.artifacts/pr3/results');
mkdirSync(out, { recursive: true });
const sourceAliases = ['_internal-core', 'schema-compat', '_internals/auth', '_internals/voice'].flatMap(pkg => {
  const dir = `${root}/packages/${pkg}`;
  const json = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  return Object.entries(json.exports).flatMap(([key, value]: [string, any]) => {
    const entry = value?.import?.default;
    if (!entry) return [];
    const source = `${dir}/${entry.replace('./dist/', 'src/').replace(/\.js$/, '.ts')}`;
    if (!existsSync(source)) throw new Error(`Missing source alias: ${source}`);
    return [{ find: new RegExp(`^${json.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${key === '.' ? '' : key.slice(1)}$`), replacement: source }];
  });
});
export default defineConfig({
  root,
  cacheDir: `${root}/.artifacts/pr3/.vite-cache`,
  define: { __MASTRA_VERSION__: JSON.stringify('1.83.0-alpha.2') },
  resolve: { alias: [
    ...sourceAliases,
    { find: /^@mastra\/core\/(.*)$/, replacement: `${root}/packages/core/src/$1` },
    { find: '@mastra/core', replacement: `${root}/packages/core/src/index.ts` },
    { find: '@internal/workflow-test-utils', replacement: `${root}/workflows/_test-utils/src` },
  ] },
  plugins: [{ name: 'pr3-source-provenance', transform(_code, id) {
    if (id.includes('/packages/')) appendFileSync(path.join(out, 'modules.jsonl'), JSON.stringify({ id }) + '\n');
  } }],
  test: {
    include: ['.artifacts/pr3/*.test.ts'],
    testTimeout: 40000,
    hookTimeout: 30000,
    fileParallelism: false,
    maxWorkers: 1,
    env: { OPENAI_API_KEY: '', OPENROUTER_API_KEY: '', ANTHROPIC_API_KEY: '', GOOGLE_GENERATIVE_AI_API_KEY: '' },
  },
});
