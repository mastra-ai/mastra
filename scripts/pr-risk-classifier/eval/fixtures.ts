import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PullFile, PullRequestInput, Risk } from '../src/types.ts';

/** A real past mastra-ai/mastra PR with the tier a maintainer would give it. */
export type EvalFixture = {
  number: number;
  url: string;
  title: string;
  body: string | null;
  expected: Risk;
  why: string;
  files: PullFile[];
};

export function loadFixtures(): EvalFixture[] {
  const dir = join(import.meta.dirname, 'fixtures');
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => JSON.parse(readFileSync(join(dir, name), 'utf8')) as EvalFixture);
}

export function toPullRequest(fixture: EvalFixture): PullRequestInput {
  return { number: fixture.number, title: fixture.title, body: fixture.body, files: fixture.files };
}
