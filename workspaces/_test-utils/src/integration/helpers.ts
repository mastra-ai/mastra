import type { CompositeFilesystem, Workspace } from '@mastra/core/workspace';

/** Cleanup all files under every mount in a CompositeFilesystem. */
export async function cleanupCompositeMounts(workspace: Workspace): Promise<void> {
  const composite = workspace.filesystem as CompositeFilesystem;
  for (const [, fs] of composite.mounts) {
    try {
      const files = await fs.readdir('/');
      for (const f of files) {
        if (f.type === 'file') await fs.deleteFile(`/${f.name}`, { force: true });
        else if (f.type === 'directory') await fs.rmdir(`/${f.name}`, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
