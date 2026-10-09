import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompositeFilesystem, LocalFilesystem } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

describe('Workspace mount configuration compatibility', () => {
  it('rejects overlapping ancestor and descendant mounts', () => {
    const filesystem = new LocalFilesystem({ basePath: tmpdir(), readOnly: true });

    expect(
      () =>
        new CompositeFilesystem({
          mounts: { '/drive': filesystem, '/drive/policies': filesystem },
        }),
    ).toThrow();
  });

  it('routes sibling mounts without treating a shared prefix as a mount', () => {
    const policies = new LocalFilesystem({ basePath: join(tmpdir(), 'policies'), readOnly: true });
    const processes = new LocalFilesystem({ basePath: join(tmpdir(), 'processes'), readOnly: true });
    const filesystem = new CompositeFilesystem({
      mounts: { '/drive/policies': policies, '/drive/processes': processes },
    });

    expect(filesystem.getFilesystemForPath('/drive/policies/guide.md')).toBe(policies);
    expect(filesystem.getFilesystemForPath('/drive/processes/guide.md')).toBe(processes);
    expect(filesystem.getFilesystemForPath('/drive/policies-other/guide.md')).toBeUndefined();
    expect(filesystem.getFilesystemForPath('/outside/guide.md')).toBeUndefined();
  });
});
