import type { RuleLatestSkip, RuleNoteInfo } from './types';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

/** What to know about the rule on its triggers, each said once: a rule on two triggers can be hidden on both. */
export function RuleNotes({
  notes,
  latestSkip,
  canEdit,
  onUngate,
}: {
  /** The notes of the rule's own lines, one per text. */
  notes: readonly RuleNoteInfo[];
  /** The item the rule skipped last; undefined when it skipped none. */
  latestSkip: RuleLatestSkip | undefined;
  canEdit: boolean;
  onUngate: () => void;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {notes.map(note => (
        <RuleNoteItem key={note.text} note={note} latestSkip={latestSkip} canEdit={canEdit} onUngate={onUngate} />
      ))}
    </div>
  );
}

/** One note: a warning, or a muted line with what it lets you do about it. */
function RuleNoteItem({
  note,
  latestSkip,
  canEdit,
  onUngate,
}: {
  note: RuleNoteInfo;
  latestSkip: RuleLatestSkip | undefined;
  canEdit: boolean;
  onUngate: () => void;
}) {
  if (note.tone === 'warning') return <Notice variant="warning">{note.text}</Notice>;

  return (
    <div className="flex flex-col items-start gap-1">
      <Txt as="p" variant="caption" tone="muted">
        {note.text}
      </Txt>
      {note.kind === 'skips' && latestSkip && <LatestSkip latest={latestSkip} />}
      {note.kind === 'outsiders' && canEdit && (
        <Button variant="ghost" size="sm" onClick={onUngate}>
          Let outside authors match
        </Button>
      )}
    </div>
  );
}

/** The item the rule skipped last, linked when it has a URL. */
function LatestSkip({ latest }: { latest: RuleLatestSkip }) {
  const { url, title } = latest;
  return (
    <Txt as="p" variant="caption" tone="muted" className="min-w-0 truncate">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="underline">
          Latest: {title}
        </a>
      ) : (
        `Latest: ${title}`
      )}
    </Txt>
  );
}
