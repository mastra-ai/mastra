export interface OwnershipView {
  _id: string;
  searchIndexName: string;
  textSearchIndexName?: string;
  ownsVectorIndex?: boolean;
  ownsTextIndex?: boolean;
  retiredTextIndexNames?: string[];
  deleting?: boolean;
}
export interface Transfer {
  toId: string;
  field: 'ownsVectorIndex' | 'ownsTextIndex';
  name: string;
}
export interface DeleteCleanupPlan {
  drop: string[];
  transfers: Transfer[];
  released: string[];
}

const owns = (v: OwnershipView, name: string) =>
  (v.ownsVectorIndex === true && v.searchIndexName === name) ||
  (v.ownsTextIndex === true && v.textSearchIndexName === name) ||
  (v.retiredTextIndexNames ?? []).includes(name);

const uses = (v: OwnershipView, name: string) => v.searchIndexName === name || v.textSearchIndexName === name;

/** Decides, per physical index owned by `own`, whether to drop it, hand it to a sibling, or release it. */
export function planDeleteCleanup(own: OwnershipView, siblings: OwnershipView[]): DeleteCleanupPlan {
  const live = siblings.filter(s => !s.deleting);
  const candidates = [
    ...(own.ownsVectorIndex === true ? [own.searchIndexName] : []),
    ...(own.ownsTextIndex === true && own.textSearchIndexName ? [own.textSearchIndexName] : []),
    ...(own.retiredTextIndexNames ?? []),
  ];
  const plan: DeleteCleanupPlan = { drop: [], transfers: [], released: [] };
  for (const name of new Set(candidates)) {
    if (live.some(s => owns(s, name))) {
      plan.released.push(name);
      continue;
    }
    const recipient = live.filter(s => uses(s, name)).sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))[0];
    if (!recipient) plan.drop.push(name);
    else
      plan.transfers.push({
        toId: recipient._id,
        field: recipient.textSearchIndexName === name ? 'ownsTextIndex' : 'ownsVectorIndex',
        name,
      });
  }
  return plan;
}
