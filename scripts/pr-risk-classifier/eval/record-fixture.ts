/**
 * Saves a real merged PR as an eval fixture:
 *   GITHUB_TOKEN=... pnpm record-fixture <pr-number> <low|medium|high> "<why this tier>"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { octokitPullRequestApi } from '../src/github.ts';
import { isRisk } from '../src/types.ts';
import type { EvalFixture } from './fixtures.ts';

const [numberArg, expected, why] = process.argv.slice(2);
const number = Number(numberArg);
if (!Number.isInteger(number) || !isRisk(expected) || !why) {
  throw new Error('Usage: record-fixture <pr-number> <low|medium|high> "<why>"');
}
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required');

const api = octokitPullRequestApi({ token, owner: 'mastra-ai', repo: 'mastra', number });
const pull = await api.getPull();
const fixture: EvalFixture = {
  number,
  url: `https://github.com/mastra-ai/mastra/pull/${number}`,
  title: pull.title,
  // Real PR descriptions predate the Risk line; tests set one explicitly when they need it.
  body: null,
  expected,
  why,
  files: await api.listFiles(),
};

const dir = join(import.meta.dirname, 'fixtures');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `pr-${number}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Saved pr-${number}.json (${fixture.files.length} files, expected ${expected})`);
