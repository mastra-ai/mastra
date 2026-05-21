import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, expectTypeOf, it } from 'vitest';

import * as toolsEntry from '../../tools';
import * as builtinToolsEntry from '../../tools/builtin';
import * as legacyHarnessEntry from '../index';
import * as harnessV1Entry from './index';
import type { ListPage, PendingResume, PersistedAttachment, QueuedItem, SessionSignalResult } from './index';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};

describe('Harness v1 — §15 package export acceptance', () => {
  it('maps @mastra/core/harness/v1 to v1 dist targets without replacing the legacy harness entry', () => {
    expect(packageJson.exports['./harness/v1']).toEqual({
      import: {
        types: './dist/harness/v1/index.d.ts',
        default: './dist/harness/v1/index.js',
      },
      require: {
        types: './dist/harness/v1/index.d.ts',
        default: './dist/harness/v1/index.cjs',
      },
    });
    expect(packageJson.exports['./harness']).toEqual({
      import: {
        types: './dist/harness/index.d.ts',
        default: './dist/harness/index.js',
      },
      require: {
        types: './dist/harness/index.d.ts',
        default: './dist/harness/index.cjs',
      },
    });

    expect(harnessV1Entry.Harness).toBeDefined();
    expect(harnessV1Entry.Session).toBeDefined();
    expect(harnessV1Entry.formatHarnessEventId).toBeTypeOf('function');
    expect(harnessV1Entry.Harness).not.toBe(legacyHarnessEntry.Harness);
  });

  it('exposes Harness built-in tools through supported tools entrypoints', () => {
    expect(packageJson.exports['./tools/builtin']).toEqual({
      import: {
        types: './dist/tools/builtin/index.d.ts',
        default: './dist/tools/builtin/index.js',
      },
      require: {
        types: './dist/tools/builtin/index.d.ts',
        default: './dist/tools/builtin/index.cjs',
      },
    });
    expect(toolsEntry.askUser).toBe(builtinToolsEntry.askUser);
    expect(toolsEntry.submitPlan).toBe(builtinToolsEntry.submitPlan);
    expect(toolsEntry.taskWrite).toBe(builtinToolsEntry.taskWrite);
    expect(toolsEntry.taskCheck).toBe(builtinToolsEntry.taskCheck);
  });

  it('preserves public type exports from earlier v1 slices', () => {
    expectTypeOf<ListPage<string>>().toMatchTypeOf<{ items: string[]; total: number }>();
    expectTypeOf<PendingResume>().toMatchTypeOf<{ kind: string; runId: string }>();
    expectTypeOf<PersistedAttachment>().toMatchTypeOf<{ kind: string; name: string; mimeType: string }>();
    expectTypeOf<QueuedItem>().toMatchTypeOf<{ id: string; content: string }>();
    expectTypeOf<SessionSignalResult>().toMatchTypeOf<{ accepted: true; runId: string }>();
  });
});
