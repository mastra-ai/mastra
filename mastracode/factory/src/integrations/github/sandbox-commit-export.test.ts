import { describe, expect, it } from 'vitest';
import { changedWorkflowFiles, parseCommitObject, parseTreeChanges } from './sandbox.js';

const tree = 't'.repeat(40);
const parent = 'p'.repeat(40);
const commitObject = (headers: string[], message = 'subject\n\nbody\n') =>
  Buffer.from(`${headers.join('\n')}\n\n${message}`, 'utf8');

describe('commit export', () => {
  it('keeps identities, timezone offsets, and the exact message', () => {
    const parsed = parseCommitObject(
      'c'.repeat(40),
      commitObject([
        `tree ${tree}`,
        `parent ${parent}`,
        'author Ada Lovelace <ada@example.com> 1700000000 +0230',
        'committer Bot <bot@example.com> 1700000100 -0530',
      ]),
    );
    expect(parsed).toMatchObject({
      tree,
      parents: [parent],
      author: { name: 'Ada Lovelace', email: 'ada@example.com', date: '2023-11-15T00:43:20+02:30' },
      committer: { name: 'Bot', email: 'bot@example.com', date: '2023-11-14T16:45:00-05:30' },
      message: 'subject\n\nbody\n',
    });
  });

  it.each([
    [
      'signed',
      [
        `tree ${tree}`,
        `parent ${parent}`,
        'author A <a@x> 1 +0000',
        'committer A <a@x> 1 +0000',
        'gpgsig -----BEGIN PGP SIGNATURE-----',
      ],
    ],
    ['root', [`tree ${tree}`, 'author A <a@x> 1 +0000', 'committer A <a@x> 1 +0000']],
  ])('refuses %s commits it cannot replay byte for byte', (_label, headers) => {
    expect(() => parseCommitObject('c'.repeat(40), commitObject(headers))).toThrow();
  });

  it('reads additions, deletions, and submodules and lists the workflow files touched', () => {
    const blob = 'b'.repeat(40);
    const zero = '0'.repeat(40);
    const raw = [
      `:000000 100644 ${zero} ${blob} A`,
      '.github/workflows/test.yml',
      `:100644 000000 ${blob} ${zero} D`,
      '.github/workflows/old.yml',
      `:000000 160000 ${zero} ${blob} A`,
      'vendor/lib',
      '',
    ].join('\0');
    const changes = parseTreeChanges(raw);
    expect(changes).toEqual([
      { path: '.github/workflows/test.yml', mode: '100644', type: 'blob', sha: blob },
      { path: '.github/workflows/old.yml', mode: '100644', type: 'blob', sha: null },
      { path: 'vendor/lib', mode: '160000', type: 'commit', sha: blob },
    ]);
    expect(changedWorkflowFiles([{ changes } as any])).toEqual([
      '.github/workflows/old.yml',
      '.github/workflows/test.yml',
    ]);
  });
});
