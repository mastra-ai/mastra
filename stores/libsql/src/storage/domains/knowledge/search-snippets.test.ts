import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createKnowledgeSearchSnippetTests } from '@internal/storage-test-utils';
import { afterAll } from 'vitest';

import { LibSQLStore } from '../../index';

const dir = mkdtempSync(join(tmpdir(), 'knowledge-snippets-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const storage = new LibSQLStore({ id: 'knowledge-snippets', url: `file:${join(dir, 'kb.db')}` });
createKnowledgeSearchSnippetTests(() => storage);
