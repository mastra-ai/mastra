import { Pin } from 'lucide-react';

import { parseRecordSegments } from '../lib/recordText';
import type { KnowledgeNotePayload, KnowledgePagePayload, KnowledgePinPayload } from '../pageTypes';

import { Txt } from '@/ds/components/Txt';

/**
 * The selected page: its scope, synopsis, body and notes. Each note shows
 * the scopes it is stamped to and who wrote it; `[[mentions]]` that resolve
 * to a loaded page become links. Stamps appear here rather than on the graph.
 */
export function KnowledgePageDetail({
  page,
  notes,
  pin,
  pagesById,
  onPageClick,
}: {
  page: KnowledgePagePayload;
  notes: KnowledgeNotePayload[];
  pin?: KnowledgePinPayload;
  /** Loaded pages, for scope names and mention links. */
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onPageClick: (page: KnowledgePagePayload) => void;
}) {
  const scope = page.isScope ? page : pagesById.get(page.scopeId);
  const scopeLabel = (id: string) => {
    const scopePage = pagesById.get(id);
    return scopePage?.address ?? scopePage?.name ?? id;
  };

  const renderText = (note: KnowledgeNotePayload) => {
    const mentioned = note.mentions.map(id => pagesById.get(id)).filter(candidate => candidate !== undefined);
    return parseRecordSegments(note.text).map((segment, index) => {
      if (segment.type === 'text') return <span key={index}>{segment.value}</span>;
      const name = segment.value.trim().toLocaleLowerCase();
      const target = mentioned.find(candidate => candidate.name.trim().toLocaleLowerCase() === name);
      return target ? (
        <button
          key={index}
          type="button"
          className="font-medium text-info-indicator hover:underline"
          onClick={() => onPageClick(target)}
        >
          {segment.value}
        </button>
      ) : (
        <span key={index} className="font-medium">
          {segment.value}
        </span>
      );
    });
  };

  return (
    <article aria-label={page.name} className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Txt as="h2" variant="heading" className="min-w-0 flex-1 truncate">
            {page.name}
          </Txt>
          {pin ? <Pin size={14} className="shrink-0 text-badge-amber-indicator" aria-label="Pinned" /> : null}
        </div>
        <Txt variant="caption" tone="muted">
          {page.isScope ? `Scope ${page.address ?? ''}`.trim() : `In ${scope?.address ?? scope?.name ?? page.scopeId}`}
        </Txt>
        {pin && pin.audience.length > 0 ? (
          <Txt variant="caption" tone="muted">
            Pinned for {pin.audience.join(', ')}
          </Txt>
        ) : null}
      </header>

      {page.description ? <Txt variant="body">{page.description}</Txt> : null}
      {page.body ? <div className="text-body whitespace-pre-wrap text-foreground">{page.body}</div> : null}

      <section aria-label="Notes" className="flex flex-col gap-2">
        <Txt as="h3" variant="caption" tone="muted" className="font-semibold">
          Notes
        </Txt>
        {notes.length === 0 ? (
          <Txt variant="body" tone="muted">
            No notes on this page.
          </Txt>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map(note => (
              <li key={note.id} className="flex flex-col gap-1 rounded-md border border-border p-3">
                <p className="text-body text-foreground">{renderText(note)}</p>
                <Txt variant="caption" tone="muted">
                  {note.provenance.author} · {note.stampScopeIds.map(scopeLabel).join(', ')}
                </Txt>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
