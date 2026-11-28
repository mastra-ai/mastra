import type { WorkspaceChanges } from '@internal/factory-contract';

export function unreadableRepositories(changes: WorkspaceChanges): string[] {
  return (changes.repositories ?? []).filter(repository => !repository.available).map(repository => repository.slug);
}
