import type { WorkspaceChanges } from '../../../../../api/types';

export function unreadableRepositories(changes: WorkspaceChanges): string[] {
  return (changes.repositories ?? []).filter(repository => !repository.available).map(repository => repository.slug);
}
