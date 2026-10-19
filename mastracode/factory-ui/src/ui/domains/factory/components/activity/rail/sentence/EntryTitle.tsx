import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import { boardItemPath, entryTarget } from '../../../../activity';
import type { ActivityEntry } from '../../../../activity';

export function EntryTitle({
  entry,
  factoryProjectId,
  flagged,
  variant,
}: {
  entry: ActivityEntry;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  variant: 'column' | 'caption';
}) {
  const target = entryTarget(entry);
  const tone = variant === 'column' ? 'ink' : 'muted';

  return (
    <span className="flex min-w-0 items-center gap-2">
      {target === undefined ? (
        <Txt as="span" variant={variant} tone={tone} className="min-w-0 truncate">
          {entry.title}
        </Txt>
      ) : (
        <Link to={boardItemPath(factoryProjectId, target)} className="min-w-0 truncate hover:underline">
          <Txt as="span" variant={variant} tone={tone} className="block truncate">
            {entry.title}
          </Txt>
        </Link>
      )}
      {flagged.has(entry) ? (
        <Badge variant="orange" size="xs" className="shrink-0">
          Needs you
        </Badge>
      ) : null}
    </span>
  );
}
