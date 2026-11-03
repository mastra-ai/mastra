import { isRecord } from '../messages/signal-data';
import type { SignalData } from '../messages/signal-data';

/** The Studio Knowledge page for a page id, opened in Page view. */
export const knowledgePageHref = (pageId: string) => `/knowledge?page=${encodeURIComponent(pageId)}&view=page`;

/** Core's pinned Knowledge state: `PINNED_KNOWLEDGE_STATE_ID` and its snapshot/delta tags in `@mastra/core/knowledge`. */
const PINNED_STATE_ID = 'knowledge';
const PINNED_TAGS = new Set(['pinned-knowledge', 'pinned-knowledge-update']);
/** The entry listing stored pins that didn't fit the budget (`PIN_OVERFLOW_ID`). */
const OVERFLOW_ID = 'overflow';

export interface PinnedPage {
  id: string;
  /** From the pin itself on newer cores; read off the delivered text's `<name> (<id>): ` prefix on older ones. */
  name?: string;
  scope?: string;
  /** What the agent was given for this pin, verbatim. */
  text?: string;
}

export type PinnedRow = PinnedPage & { change?: 'add' | 'change' | 'remove' };

export interface PinnedKnowledge {
  mode: 'snapshot' | 'delta';
  rows: PinnedRow[];
  /** The "Also pinned …" line when stored pins overflowed the budget. */
  overflow?: string;
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

function toPage(value: unknown): PinnedPage | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  if (!id) return undefined;
  const text = str(value.text);
  let name = str(value.name);
  if (!name && text) {
    const at = text.indexOf(` (${id}): `);
    if (at > 0) name = text.slice(0, at);
  }
  return { id, name, scope: str(value.scope), text };
}

/** A signal's pinned Knowledge, or undefined when it is some other signal or a shape we don't know. */
export function pinnedKnowledgeFromSignal(
  signal: Pick<SignalData, 'tagName' | 'metadata' | 'attributes'>,
): PinnedKnowledge | undefined {
  const metadata = isRecord(signal.metadata) ? signal.metadata : undefined;
  const state = isRecord(metadata?.state) ? metadata.state : undefined;
  const stateId = state?.id ?? signal.attributes?.id;
  if (stateId !== PINNED_STATE_ID && !(signal.tagName && PINNED_TAGS.has(signal.tagName))) return undefined;
  const delta = isRecord(metadata?.delta) ? metadata.delta : undefined;
  const stateMode = state?.mode ?? signal.attributes?.mode;
  const mode =
    stateMode === 'delta' || (!stateMode && signal.tagName === 'pinned-knowledge-update') ? 'delta' : 'snapshot';

  let overflow: string | undefined;
  const rows: PinnedRow[] = [];
  if (mode === 'delta') {
    if (!Array.isArray(delta?.ops)) return undefined;
    for (const op of delta.ops) {
      if (!isRecord(op)) continue;
      if (op.op === 'remove') {
        const removed = toPage(op);
        if (removed && removed.id !== OVERFLOW_ID) rows.push({ ...removed, change: 'remove' });
        continue;
      }
      if (op.op !== 'add' && op.op !== 'change') continue;
      const page = toPage(op.pin);
      if (!page) continue;
      if (page.id === OVERFLOW_ID) overflow = page.text;
      else rows.push({ ...page, change: op.op });
    }
  } else {
    const value = isRecord(metadata?.value) ? metadata.value : undefined;
    if (!Array.isArray(value?.pins)) return undefined;
    for (const pin of value.pins) {
      const page = toPage(pin);
      if (!page) continue;
      if (page.id === OVERFLOW_ID) overflow = page.text;
      else rows.push(page);
    }
  }
  return { mode, rows, overflow };
}
