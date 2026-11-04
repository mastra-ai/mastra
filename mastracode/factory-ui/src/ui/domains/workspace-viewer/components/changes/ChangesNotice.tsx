import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceChangePatches } from '../../../../../api/types';

function unreadableRepositories(changes: WorkspaceChangePatches): string[] {
  if (!changes.available) return [];
  return (changes.repositories ?? []).filter(repository => !repository.available).map(repository => repository.slug);
}

export function ChangesNotice({ changes }: { changes: WorkspaceChangePatches }) {
  const unreadable = unreadableRepositories(changes);
  const messages = [
    ...(unreadable.length > 0 ? [`Couldn't read changes in ${unreadable.join(', ')}`] : []),
    ...(changes.diffError ? [`Diffs unavailable: ${changes.diffError}`] : []),
  ];
  if (messages.length === 0) return null;

  return (
    <div className="border-border border-b px-3 py-2">
      {messages.map(message => (
        <Txt key={message} variant="caption" className="text-destructive-foreground wrap-anywhere">
          {message}
        </Txt>
      ))}
    </div>
  );
}
