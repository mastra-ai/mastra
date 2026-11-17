export interface OwnershipView {
  _id: string;
  searchIndexName: string;
  textSearchIndexName?: string;
  ownsVectorIndex?: boolean;
  ownsTextIndex?: boolean;
  retiredTextIndexNames?: string[];
  retiredVectorIndexNames?: string[];
  indexIds?: { name: string; id: string }[];
  deleting?: boolean;
}
export interface Transfer {
  toId: string;
  field: 'ownsVectorIndex' | 'ownsTextIndex';
  name: string;
  id?: string;
}
export interface DeleteCleanupPlan {
  drop: string[];
  transfers: Transfer[];
  released: string[];
  /** `indexIds` entries of other registrations to set to a confirmed id (I11b). */
  rewrites: { toId: string; name: string; id: string }[];
  /** Referenced names whose incarnation this registration can't prove: neither dropped nor handed over. */
  kept: string[];
}

const retired = (v: OwnershipView) => [...(v.retiredTextIndexNames ?? []), ...(v.retiredVectorIndexNames ?? [])];

/** Whether `v` owns `name`: a current name with its flag, or a retired name of either role. */
export const owns = (v: OwnershipView, name: string) =>
  (v.ownsVectorIndex === true && v.searchIndexName === name) ||
  (v.ownsTextIndex === true && v.textSearchIndexName === name) ||
  retired(v).includes(name);

/** Whether `v` references `name`: a current or retired name of either role. */
export const uses = (v: OwnershipView, name: string) =>
  v.searchIndexName === name || v.textSearchIndexName === name || retired(v).includes(name);

/** The id `v` records for search index `name`, if any. */
export function idFor(v: OwnershipView, name: string): string | undefined {
  return v.indexIds?.find(e => e.name === name)?.id;
}

/**
 * Decides, per physical index owned by `own`, whether to drop it, hand it to a sibling, or release
 * it (§3.4 T1). Any live sibling referencing a name blocks its drop (I11a); `observed` (the name's
 * listed id, taken just before) only decides which ids may be written (I11b).
 */
export function planDeleteCleanup(
  own: OwnershipView,
  siblings: OwnershipView[],
  observed: Record<string, string | undefined>,
): DeleteCleanupPlan {
  const live = siblings.filter(s => !s.deleting);
  const candidates = [
    ...(own.ownsVectorIndex === true ? [own.searchIndexName] : []),
    ...(own.ownsTextIndex === true && own.textSearchIndexName ? [own.textSearchIndexName] : []),
    ...retired(own),
  ];
  const plan: DeleteCleanupPlan = { drop: [], transfers: [], released: [], rewrites: [], kept: [] };
  for (const name of new Set(candidates)) {
    const ownId = idFor(own, name);
    const confirmed = ownId !== undefined && observed[name] === ownId ? ownId : undefined;
    const owners = live.filter(s => owns(s, name));
    if (owners.length) {
      plan.released.push(name);
      if (confirmed)
        for (const s of owners)
          if (idFor(s, name) !== confirmed) plan.rewrites.push({ toId: s._id, name, id: confirmed });
      continue;
    }
    const recipient = live.filter(s => uses(s, name)).sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))[0];
    if (!recipient) {
      plan.drop.push(name);
      continue;
    }
    // Case 1: own proven id confirmed by the listing; case 2: Q5 TOFU for a legacy no-id owner.
    const id = confirmed ?? (ownId === undefined ? observed[name] : undefined);
    if (id === undefined) {
      plan.kept.push(name);
      continue;
    }
    plan.transfers.push({
      toId: recipient._id,
      field: recipient.textSearchIndexName === name ? 'ownsTextIndex' : 'ownsVectorIndex',
      name,
      id,
    });
    if (confirmed && idFor(recipient, name) !== undefined && idFor(recipient, name) !== confirmed)
      plan.rewrites.push({ toId: recipient._id, name, id: confirmed });
  }
  return plan;
}
