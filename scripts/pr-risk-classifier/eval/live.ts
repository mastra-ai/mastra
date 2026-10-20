/**
 * Runs every fixture in eval/fixtures through the real model and reports agreement with the
 * expected tier. Needs OPENROUTER_API_KEY; RISK_MODEL overrides the model.
 *
 *   OPENROUTER_API_KEY=... pnpm eval:live
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WorkspaceIndex } from '../src/blast-radius.ts';
import { classifyPullRequest } from '../src/classify.ts';
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from '../src/model.ts';
import { loadFixtures, toPullRequest } from './fixtures.ts';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for the live eval');

const root = join(import.meta.dirname, '..');
const index = WorkspaceIndex.load(join(root, '..', '..'));
const rubric = readFileSync(join(root, 'rubric.md'), 'utf8');
const model = { apiKey, model: process.env.RISK_MODEL || DEFAULT_MODEL, baseUrl: process.env.RISK_MODEL_BASE_URL || DEFAULT_BASE_URL };

let agreed = 0;
const fixtures = loadFixtures();
for (const fixture of fixtures) {
  try {
    const result = await classifyPullRequest({ pr: toPullRequest(fixture), index, rubric, model });
    const ok = result.risk === fixture.expected;
    if (ok) agreed++;
    console.log(`${ok ? 'ok  ' : 'MISS'} #${fixture.number} expected ${fixture.expected}, got ${result.risk} (${result.source}) — ${result.summary}`);
  } catch (error) {
    console.log(`ERR  #${fixture.number}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`\n${agreed}/${fixtures.length} fixtures matched with ${model.model}`);
if (agreed < fixtures.length) process.exitCode = 1;
