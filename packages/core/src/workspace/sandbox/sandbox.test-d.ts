import { describe, expectTypeOf, it } from 'vitest';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { WorkspaceSandbox } from './sandbox';

declare const nativeFilesystem: WorkspaceFilesystem;

describe('WorkspaceSandbox.filesystem', () => {
  it('is an optional WorkspaceFilesystem', () => {
    expectTypeOf<WorkspaceSandbox['filesystem']>().toEqualTypeOf<WorkspaceFilesystem | undefined>();
  });

  it('accepts a sandbox that exposes a native filesystem', () => {
    const sandbox = {
      id: 'sbx',
      name: 'sbx',
      provider: 'test',
      status: 'running',
      snapshot: async () => {},
      filesystem: nativeFilesystem,
    } satisfies WorkspaceSandbox;

    expectTypeOf(sandbox).toMatchTypeOf<WorkspaceSandbox>();
    expectTypeOf(sandbox.filesystem).toEqualTypeOf<WorkspaceFilesystem>();
  });
});
