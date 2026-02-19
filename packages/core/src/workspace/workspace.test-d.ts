import { describe, expectTypeOf, it } from 'vitest';
import type { CompositeFilesystem, MountMapEntry } from './filesystem/composite-filesystem';
import type { WorkspaceFilesystem } from './filesystem/filesystem';
import { LocalFilesystem } from './filesystem/local-filesystem';
import { LocalSandbox } from './sandbox/local-sandbox';
import type { WorkspaceSandbox } from './sandbox/sandbox';
import { Workspace } from './workspace';

/**
 * Type tests for Workspace generic inference.
 *
 * These run via tsc (vitest typecheck project) and catch type regressions
 * that runtime tests miss because esbuild strips types.
 */
describe('Workspace generic type inference', () => {
  it('should infer filesystem type from constructor', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: './data' }),
    });

    expectTypeOf(workspace.filesystem).toEqualTypeOf<LocalFilesystem>();
  });

  it('should infer sandbox type from constructor', () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: './data' }),
    });

    expectTypeOf(workspace.sandbox).toEqualTypeOf<LocalSandbox>();
  });

  it('should infer both filesystem and sandbox types', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: './data' }),
      sandbox: new LocalSandbox({ workingDirectory: './data' }),
    });

    expectTypeOf(workspace.filesystem).toEqualTypeOf<LocalFilesystem>();
    expectTypeOf(workspace.sandbox).toEqualTypeOf<LocalSandbox>();
  });

  it('should default to base types | undefined when not configured', () => {
    const workspace = new Workspace({});

    expectTypeOf(workspace.filesystem).toEqualTypeOf<WorkspaceFilesystem | undefined>();
    expectTypeOf(workspace.sandbox).toEqualTypeOf<WorkspaceSandbox | undefined>();
  });

  it('should return CompositeFilesystem when mounts are used', () => {
    const workspace = new Workspace({
      mounts: {
        '/local': new LocalFilesystem({ basePath: './data' }),
      },
    });

    expectTypeOf(workspace.filesystem).toEqualTypeOf<CompositeFilesystem<{ '/local': LocalFilesystem }>>();
  });

  it('should preserve concrete mount types via mounts.get()', () => {
    const workspace = new Workspace({
      mounts: {
        '/local': new LocalFilesystem({ basePath: './data' }),
        '/other': new LocalFilesystem({ basePath: './other' }),
      },
    });

    const local = workspace.filesystem.mounts.get('/local');
    expectTypeOf(local).toEqualTypeOf<LocalFilesystem>();

    const other = workspace.filesystem.mounts.get('/other');
    expectTypeOf(other).toEqualTypeOf<LocalFilesystem>();
  });

  it('should return WorkspaceFilesystem | undefined for unknown mount keys', () => {
    const workspace = new Workspace({
      mounts: {
        '/local': new LocalFilesystem({ basePath: './data' }),
      },
    });

    const unknown = workspace.filesystem.mounts.get('/unknown');
    expectTypeOf(unknown).toEqualTypeOf<WorkspaceFilesystem | undefined>();
  });

  it('should produce correlated MountMapEntry tuples from entries()', () => {
    type Mounts = {
      '/local': LocalFilesystem;
      '/other': LocalFilesystem;
    };

    type Expected = ['/local', LocalFilesystem] | ['/other', LocalFilesystem];
    expectTypeOf<MountMapEntry<Mounts>>().toEqualTypeOf<Expected>();
  });
});
