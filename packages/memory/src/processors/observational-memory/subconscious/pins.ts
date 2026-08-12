import { createHash } from 'node:crypto';

import type { ProcessorContext } from '@mastra/core/processors';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';

export const SUBCONSCIOUS_PINNED_STATE_ID = 'subconscious-pinned';
export const PINNED_KNOWLEDGE_PAGE = 'pinned-knowledge';
export const DEFAULT_PINNED_MAX_CHARACTERS = 2_000;
export const MAX_PINNED_MAX_CHARACTERS = 8_000;

export interface SubconsciousPinnedSnapshot {
  body: string;
  pageId?: string;
  version?: number;
}

export async function buildSubconsciousPinnedSnapshot(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  maxCharacters: number;
}): Promise<SubconsciousPinnedSnapshot | undefined> {
  const page = await input.store.getPageByName({ name: PINNED_KNOWLEDGE_PAGE, scope: input.scope });
  const body = page?.body.trim();
  if (!body) return undefined;
  return { body: body.slice(0, input.maxCharacters), pageId: page?.id, version: page?.version };
}

export function renderSubconsciousPinned(snapshot: SubconsciousPinnedSnapshot): string {
  return snapshot.body;
}

/**
 * Publishes the curator-maintained pinned page as a snapshot state signal.
 *
 * The signal is unconditional and content bearing, which is what separates it from the
 * activity lane: activity carries breadcrumbs, this carries the knowledge itself. An
 * unchanged page produces an unchanged cache key, so a stable pin set costs nothing after
 * the first turn. The size bound is enforced on the write path rather than here, because
 * the cost of a pin is per turn and permanent.
 */
export async function publishSubconsciousPinned(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  maxCharacters: number;
  sendStateSignal?: ProcessorContext['sendStateSignal'];
}): Promise<SubconsciousPinnedSnapshot | undefined> {
  if (!input.sendStateSignal) return undefined;
  const snapshot = await buildSubconsciousPinnedSnapshot(input);
  if (!snapshot) return undefined;
  const contents = renderSubconsciousPinned(snapshot);
  await input.sendStateSignal({
    id: SUBCONSCIOUS_PINNED_STATE_ID,
    mode: 'snapshot',
    cacheKey: createHash('sha256').update(contents).digest('hex'),
    tagName: 'state',
    attributes: { id: SUBCONSCIOUS_PINNED_STATE_ID },
    metadata: { origin: 'subconscious' },
    contents,
    value: snapshot,
  });
  return snapshot;
}
