import { FileSystemBehaviorResolver } from './resolver.js';

/** Load a filesystem-first behavior tree whose nodes are defined by BEHAVIOR.md files. */
export async function loadBehaviorDirectory(directory: string, id?: string): Promise<FileSystemBehaviorResolver> {
  return FileSystemBehaviorResolver.create(directory, id);
}
