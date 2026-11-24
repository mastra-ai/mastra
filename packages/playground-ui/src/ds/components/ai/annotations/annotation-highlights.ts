import './annotation-highlights.css';

/** Named in `annotation-highlights.css`. */
const HIGHLIGHT = 'chat-annotation';
const ACTIVE_HIGHLIGHT = 'chat-annotation-active';

const paintedByTranscript = new Map<string, { ranges: Range[]; active: Range | undefined }>();

export function paintHighlights(transcriptId: string, ranges: Range[], active: Range | undefined) {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (ranges.length === 0) paintedByTranscript.delete(transcriptId);
  else paintedByTranscript.set(transcriptId, { ranges, active });
  const painted = Array.from(paintedByTranscript.values());
  const allRanges = painted.flatMap(entry => entry.ranges);
  const activeRanges = painted.flatMap(entry => (entry.active ? [entry.active] : []));
  if (allRanges.length === 0) CSS.highlights.delete(HIGHLIGHT);
  else CSS.highlights.set(HIGHLIGHT, new Highlight(...allRanges));
  if (activeRanges.length === 0) {
    CSS.highlights.delete(ACTIVE_HIGHLIGHT);
    return;
  }
  const emphasis = new Highlight(...activeRanges);
  emphasis.priority = 1;
  CSS.highlights.set(ACTIVE_HIGHLIGHT, emphasis);
}
