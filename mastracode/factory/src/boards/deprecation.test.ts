import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraFactory } from '../factory.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import { createTestBoard } from './test-utils.js';

// The warning is once per process, and each test file runs in its own module scope, so the order
// of these tests is part of what they check.

const DEPRECATION =
  '[Mastra Factory] MastraFactory({ boards }) and defineBoard() are deprecated: boards now live in the database and these definitions are only used as seed input. Manage boards through the boards API; see the README "Stored boards" section.';

function construct(config: Partial<ConstructorParameters<typeof MastraFactory>[0]> = {}) {
  return new MastraFactory({
    storage: new LibSQLFactoryStorage({ id: 'deprecation', url: ':memory:' }),
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
    ...config,
  });
}

function deprecationWarnings(warn: ReturnType<typeof vi.spyOn>) {
  return warn.mock.calls.filter(([message]) => message === DEPRECATION);
}

describe('deprecating boards declared in code', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('says nothing for an app that only uses the built-in boards', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    construct();
    construct({ includeDefaultBoards: true });
    expect(deprecationWarnings(warn)).toEqual([]);
  });

  it('warns once per process for an app that passes its own boards', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    construct({ boards: [createTestBoard({ id: 'release' })] });
    construct({ boards: [createTestBoard({ id: 'hotfix' })] });
    expect(deprecationWarnings(warn)).toHaveLength(1);
  });
});
