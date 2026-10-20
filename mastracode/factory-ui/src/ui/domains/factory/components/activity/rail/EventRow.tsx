import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ActivityEntry } from '../../../activity';
import type { FactoryMentionMember } from '../../../services/members';
import { RailRow } from '../../Timeline';
import { EntryNode } from './sentence/EntryNode';
import { EntrySentence } from './sentence/EntrySentence';

/** One audit event on its own line, with its recorded fields one toggle away. */
export function EventRow({
  entry,
  roster,
  factoryProjectId,
  flagged,
  compact,
}: {
  entry: ActivityEntry;
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detail = entry.kind === 'deed' ? entry.detail : '';
  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <RailRow mark={<EntryNode entry={entry} />} connected={false}>
      <EntrySentence
        entries={[entry]}
        roster={roster}
        factoryProjectId={factoryProjectId}
        flagged={flagged}
        compact={compact}
        trailing={
          hasMetadata ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              tooltip="Details"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <DisclosureChevron direction={open ? 'down' : 'right'} />
            </Button>
          ) : (
            <span aria-hidden className="w-7 shrink-0" />
          )
        }
      >
        {detail === '' ? null : (
          <Txt as="span" variant="caption" tone="faint" className="min-w-0 truncate">
            {detail}
          </Txt>
        )}
      </EntrySentence>
      {open ? (
        <Code
          code={JSON.stringify(entry.metadata, null, 2)}
          lang="json"
          className="text-meta font-body text-muted-foreground m-0 mt-1 mb-2 px-2 py-1 break-all whitespace-pre-wrap"
        />
      ) : null}
    </RailRow>
  );
}
