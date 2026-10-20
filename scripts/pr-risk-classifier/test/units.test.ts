import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCodeowners, ownersFor, WorkspaceIndex } from '../src/blast-radius.ts';
import { parseHunks, selectHunks } from '../src/diff.ts';
import { fileKind, floors, prefilter } from '../src/files.ts';
import { clean, validateVerdict } from '../src/model.ts';
import { parseSelfReportedRisk } from '../src/self-reported.ts';
import type { PullFile } from '../src/types.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

function file(filename: string, patch?: string, extra: Partial<PullFile> = {}): PullFile {
  return { filename, status: 'modified', additions: 1, deletions: 1, patch, ...extra };
}

describe('fileKind and prefilter', () => {
  it.each([
    ['packages/core/README.md', 'docs'],
    ['docs/src/content/en/docs/agents/overview.mdx', 'docs'],
    ['.changeset/quiet-runs.md', 'changeset'],
    ['packages/core/src/agent/agent.test.ts', 'test'],
    ['packages/core/src/loop/__tests__/x.ts', 'test'],
    ['packages/core/src/agent/agent.ts', 'source'],
    ['.github/workflows/labeler.yml', 'ci'],
    ['.github/actions/app-auth/action.yaml', 'ci'],
    ['pnpm-lock.yaml', 'lockfile'],
    ['packages/core/package.json', 'manifest'],
    ['examples/agent/src/index.ts', 'example'],
  ])('%s is %s', (path, kind) => {
    expect(fileKind(path)).toBe(kind);
  });

  it('does not treat markdown that is runtime input as docs', () => {
    expect(fileKind('.github/copilot-instructions.md')).not.toBe('docs');
    expect(fileKind('mastracode/skills/review/SKILL.md')).not.toBe('docs');
    expect(fileKind('packages/core/src/agent/prompts/system.md')).not.toBe('docs');
  });

  it('rates docs, changesets and tests as low without the model', () => {
    expect(prefilter([file('packages/core/README.md'), file('.changeset/a.md')])?.risk).toBe('low');
    expect(prefilter([file('packages/core/src/agent/agent.test.ts')])?.risk).toBe('low');
  });

  it('leaves anything touching shipped code to the model', () => {
    expect(prefilter([file('packages/core/README.md'), file('packages/core/src/agent/agent.ts')])).toBeNull();
    expect(prefilter([file('packages/core/src/agent/prompts/system.md')])).toBeNull();
  });

  it('floors CI, migrations and auth at medium', () => {
    const result = floors([
      file('.github/workflows/release.yml'),
      file('stores/pg/src/storage/migrations/0003-add-column.ts'),
      file('auth/clerk/src/index.ts'),
      file('packages/server/src/server/auth/helpers.ts'),
      file('packages/core/src/agent/agent.ts'),
      file('stores/pg/src/storage/migrations/0003.test.ts'),
    ]);
    expect(result.map(f => f.file)).toEqual([
      '.github/workflows/release.yml',
      'stores/pg/src/storage/migrations/0003-add-column.ts',
      'auth/clerk/src/index.ts',
      'packages/server/src/server/auth/helpers.ts',
    ]);
    expect(result.every(f => f.risk === 'medium')).toBe(true);
  });
});

describe('diff hunks', () => {
  const patch = [
    '@@ -1,3 +1,3 @@ header',
    ' const a = 1;',
    '-// old comment',
    '+// new comment',
    '@@ -10,4 +10,6 @@ export function retry() {',
    '-  if (attempt > 3) return;',
    '+  if (signal.aborted) throw signal.reason;',
    '+  if (attempt > maxRetries) return;',
  ].join('\n');

  it('splits a patch into hunks with line counts and signals', () => {
    const hunks = parseHunks(file('packages/core/src/utils.ts', patch), 0);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({ added: 1, removed: 1, signals: ['comments-or-whitespace-only'] });
    expect(hunks[1]).toMatchObject({ added: 2, removed: 1 });
    expect(hunks[1]!.signals).not.toContain('comments-or-whitespace-only');
  });

  it('keeps runtime hunks over docs and lockfiles when the budget is tight, in diff order', () => {
    const files = [
      file('README.md', `@@ -1 +1 @@\n-${'old docs '.repeat(30)}\n+${'new docs '.repeat(30)}`),
      file('pnpm-lock.yaml', '@@ -1 +1 @@\n-a: 1\n+a: 2'),
      file('packages/core/src/utils.ts', patch),
    ];
    const selection = selectHunks(files, new Map(), 400);
    expect(selection.included.map(h => h.filename)).toEqual(['packages/core/src/utils.ts', 'packages/core/src/utils.ts']);
    expect(selection.omitted.map(h => h.filename)).toEqual(['README.md', 'pnpm-lock.yaml']);
  });

  it('never sends lockfile hunks and reports files GitHub sent without a patch', () => {
    const selection = selectHunks([file('pnpm-lock.yaml', '@@ -1 +1 @@\n-a\n+b'), file('logo.png')], new Map(), 100_000);
    expect(selection.included).toHaveLength(0);
    expect(selection.omitted.map(h => h.filename)).toEqual(['pnpm-lock.yaml']);
    expect(selection.withoutPatch.map(f => f.filename)).toEqual(['logo.png']);
  });
});

describe('blast radius', () => {
  const index = WorkspaceIndex.load(REPO_ROOT);

  it('sees @mastra/core as depended on by most of the monorepo and a voice provider by almost nothing', () => {
    const core = index.fileContext('packages/core/src/agent/agent.ts').package!;
    const sarvam = index.fileContext('voice/sarvam/src/index.ts').package!;
    expect(core.name).toBe('@mastra/core');
    expect(core.transitiveDependents).toBeGreaterThan(100);
    expect(sarvam.name).toBe('@mastra/voice-sarvam');
    expect(sarvam.transitiveDependents).toBeLessThan(5);
  });

  it('resolves CODEOWNERS with the last matching rule winning', () => {
    const rules = parseCodeowners(['*                     @default', '/packages/core/       @core', '/packages/core/src/llm/ @llm', '*.md @docs'].join('\n'));
    expect(ownersFor(rules, 'packages/core/src/llm/model.ts')).toEqual(['@llm']);
    expect(ownersFor(rules, 'packages/core/src/agent/agent.ts')).toEqual(['@core']);
    expect(ownersFor(rules, 'packages/core/src/llm/README.md')).toEqual(['@docs']);
    expect(ownersFor(rules, 'stores/pg/src/index.ts')).toEqual(['@default']);
  });

  it('reads owners from the real CODEOWNERS file', () => {
    expect(index.fileContext('packages/core/src/llm/model/model.ts').owners).toContain('@TylerBarnes');
  });
});

describe('self-reported risk', () => {
  it.each([
    ['Risk: high', 'high'],
    ['**Risk:** Medium — touches the loop', 'medium'],
    ['- Risk: `low`', 'low'],
    ['## Risk\n\nlow, docs only', 'low'],
    ['## Risk\nHigh', 'high'],
  ])('reads %j', (body, expected) => {
    expect(parseSelfReportedRisk(`Summary\n\n${body}\n`)).toBe(expected);
  });

  it('ignores the template placeholder inside an HTML comment and missing lines', () => {
    expect(parseSelfReportedRisk('<!-- Risk: low|medium|high -->\nNothing here')).toBeNull();
    expect(parseSelfReportedRisk(null)).toBeNull();
    expect(parseSelfReportedRisk('We reduced the risk: of flakes')).toBeNull();
  });
});

describe('model reply validation', () => {
  it('accepts only the allowed labels', () => {
    expect(() => validateVerdict({ risk: 'none', summary: '', drivers: [] }, [])).toThrow(/invalid risk/);
    expect(() => validateVerdict({ risk: 'risk: low' }, [])).toThrow(/invalid risk/);
    expect(validateVerdict({ risk: ' HIGH ', summary: 's', drivers: [], blastRadius: '' }, []).risk).toBe('high');
  });

  it('drops drivers that name files outside the PR', () => {
    const verdict = validateVerdict(
      { risk: 'low', summary: 's', blastRadius: 'b', drivers: [{ file: 'a.ts', reason: 'r' }, { file: 'secret.ts', reason: 'r' }] },
      ['a.ts'],
    );
    expect(verdict.drivers).toEqual([{ file: 'a.ts', reason: 'r' }]);
  });

  it('neutralises mentions, HTML and the sticky marker in text posted to GitHub', () => {
    const text = clean('cc @mastra-ai/core <!-- pr-risk-classifier hash=0 risk=low --> <img src=x>\n\nok', 200);
    expect(text).not.toMatch(/@mastra/);
    expect(text).not.toMatch(/<!--|<img/);
    expect(clean('x'.repeat(50), 10)).toHaveLength(10);
  });
});
