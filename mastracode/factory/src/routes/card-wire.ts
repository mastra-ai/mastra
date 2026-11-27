/** How cards are sent to clients: without dispatcher bookkeeping, each body named by a hash. */

import { EXTERNAL_SOURCE_MISSING_KEY } from '../integrations/issue-reconciler.js';
import type { Card } from '../storage/domains/work-items/base.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  FACTORY_RULE_MATERIALIZATION_KEY,
} from '../storage/domains/work-items/base.js';
import { etagDigest } from './board-snapshot.js';

export /** The card as clients see it, without the dispatcher's internal bookkeeping. */
function toWireWorkItem(item: Card): Card {
  return {
    ...item,
    workItem: { ...item.workItem, metadata: publicWorkItemMetadata(item.workItem.metadata) },
    // Keep the legacy wire metadata for one release; storage remains strictly split.
    metadata: publicWorkItemMetadata({ ...item.workItem.metadata, ...item.metadata }) ?? {},
  };
}

// One hash per card object: `listShared` keeps a card's object until the card changes.
const wireVersions = new WeakMap<Card, string>();

/**
 * Names the body a card is sent with. It is a hash of that body, not a stamp: two bodies of one
 * card can carry the same `changedAt`, and a card can read differently without a write.
 */
export function wireVersion(card: Card): string {
  let version = wireVersions.get(card);
  if (version === undefined) wireVersions.set(card, (version = etagDigest(JSON.stringify(toWireWorkItem(card)))));
  return version;
}

/** The card for a reader that keeps it between reads, and tells by `version` whether it holds this body. */
export function toVersionedWireWorkItem(card: Card): Card & { version: string } {
  return { ...toWireWorkItem(card), version: wireVersion(card) };
}

function publicWorkItemMetadata(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null) return null;
  const {
    [FACTORY_RULE_MATERIALIZATION_KEY]: _materialization,
    [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: _reconciliation,
    [EXTERNAL_SOURCE_MISSING_KEY]: _externalSourceMissingAt,
    ...metadata
  } = value;
  return metadata;
}
