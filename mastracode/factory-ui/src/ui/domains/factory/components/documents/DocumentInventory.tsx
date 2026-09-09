import { Badge } from '@mastra/playground-ui/components/Badge';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import type { FactoryDocumentGroup, FactoryDocumentInventoryRow } from '../../services/documents';
import { countPresent, DOCUMENT_GROUP_LABELS, DOCUMENT_GROUPS } from '../../services/documents';
import { PANEL_ROW_LINK, TIMESTAMP } from '../panel';
import { DOCUMENT_STATUS_STYLE } from './documentStatus';

interface DocumentInventoryProps {
  groups: Record<FactoryDocumentGroup, FactoryDocumentInventoryRow[]>;
  selectedKind: string | null;
  onSelect: (kind: string) => void;
}

/** The catalog as two sections, one row per kind, selection driving the reader. */
export function DocumentInventory({ groups, selectedKind, onSelect }: DocumentInventoryProps) {
  return (
    <ScrollArea className="min-h-0 flex-1" revealScrollbarOnHover={false}>
      <div className="flex flex-col gap-6 pr-1">
        {DOCUMENT_GROUPS.map(group => {
          const rows = groups[group];
          const { present, total } = countPresent(rows);
          return (
            <section key={group} aria-label={DOCUMENT_GROUP_LABELS[group]} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between px-3 pb-1">
                <Txt as="h2" variant="ui-sm" className="text-icon6 font-medium">
                  {DOCUMENT_GROUP_LABELS[group]}
                </Txt>
                <Txt as="span" variant="ui-xs" className="text-icon3">
                  {present} of {total} present
                </Txt>
              </div>
              <ul className="flex flex-col">
                {rows.map(row => (
                  <li key={row.kind}>
                    <DocumentRow row={row} selected={row.kind === selectedKind} onSelect={() => onSelect(row.kind)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function DocumentRow({
  row,
  selected,
  onSelect,
}: {
  row: FactoryDocumentInventoryRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const { tone, label, icon: Icon } = DOCUMENT_STATUS_STYLE[row.status];
  const title = row.document?.title ?? row.label;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(PANEL_ROW_LINK, 'w-full text-left', selected && 'bg-surface4')}
    >
      <Icon
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className={cn('shrink-0', row.status === 'missing' ? 'text-icon3' : 'text-icon5')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Txt as="span" variant="ui-sm" className="text-icon6 min-w-0 truncate font-medium" title={title}>
            {title}
          </Txt>
          {row.document?.title && row.document.title !== row.label ? (
            <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 truncate">
              {row.label}
            </Txt>
          ) : null}
        </div>
        <Txt as="span" variant="ui-xs" className="text-icon3 min-w-0 truncate font-mono" title={row.path}>
          {row.path}
        </Txt>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {row.document ? <span className={TIMESTAMP}>{relativeTime(row.document.syncedAt)}</span> : null}
        <Badge size="xs" variant={tone} emphasis="muted">
          {label}
        </Badge>
      </div>
    </button>
  );
}
