import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { ruleNotes } from '../../canvasModel';
import type { RuleLine, RuleNote, RuleSkips } from '../../canvasModel';

/** What to know about the rule on its triggers, each said once: a rule on two triggers can be hidden on both. */
export function RuleNotes({
  lines,
  canEdit,
  onUngate,
}: {
  /** The rule's own lines, one per trigger. */
  lines: readonly RuleLine[];
  canEdit: boolean;
  onUngate: () => void;
}) {
  const notes = [...new Map(lines.flatMap(ruleNotes).map(note => [note.text, note])).values()];
  const skips = lines.find(line => line.skips)?.skips;
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {notes.map(note => (
        <RuleNoteItem key={note.text} note={note} skips={skips} canEdit={canEdit} onUngate={onUngate} />
      ))}
    </div>
  );
}

/** One note: a warning, or a muted line with what it lets you do about it. */
function RuleNoteItem({
  note,
  skips,
  canEdit,
  onUngate,
}: {
  note: RuleNote;
  skips: RuleSkips | undefined;
  canEdit: boolean;
  onUngate: () => void;
}) {
  if (note.tone === 'warning') return <Notice variant="warning">{note.text}</Notice>;

  return (
    <div className="flex flex-col items-start gap-1">
      <Txt as="p" variant="caption" tone="muted">
        {note.text}
      </Txt>
      {note.kind === 'skips' && skips && <LatestSkip skips={skips} />}
      {note.kind === 'outsiders' && canEdit && (
        <Button variant="ghost" size="sm" onClick={onUngate}>
          Let outside authors match
        </Button>
      )}
    </div>
  );
}

/** The item the rule skipped last, linked when it has a URL. */
function LatestSkip({ skips }: { skips: RuleSkips }) {
  const { url, title } = skips.latest;
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
