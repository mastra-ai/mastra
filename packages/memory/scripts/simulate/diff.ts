/**
 * Pure knowledge differ for the conversation simulator.
 *
 * Two arms of the same replay produce knowledge with different ids (ULIDs are
 * minted per write), so nothing here compares ids across arms. Nodes are matched
 * by canonical name and records are matched by normalized text.
 *
 * Within a single arm, records are deduped by id: knowledge writes are
 * at-least-once, so the same record can be observed twice and must count once.
 */

export type SnapshotNode = {
  id: string;
  name: string;
};

export type SnapshotRecord = {
  id: string;
  /** Node id this record hangs off. */
  node: string;
  text: string;
};

export type ArmSnapshot = {
  nodes: SnapshotNode[];
  records: SnapshotRecord[];
};

export type NodeRecordDiff = {
  node: string;
  /** Whether the node exists in both arms or only one of them. */
  presence: 'both' | 'only-a' | 'only-b';
  /** Normalized record texts present only in arm B. */
  added: string[];
  /** Normalized record texts present only in arm A. */
  removed: string[];
  /** Paired records the two arms wrote differently (normalized text). */
  changed: { a: string; b: string }[];
};

export type KnowledgeDiff = {
  aNodeCount: number;
  bNodeCount: number;
  aRecordCount: number;
  bRecordCount: number;
  onlyInA: string[];
  onlyInB: string[];
  matchedNodes: string[];
  /** Per-node record differences, including nodes present in only one arm. */
  perNode: NodeRecordDiff[];
  addedRecords: number;
  removedRecords: number;
  changedRecords: number;
};

function canonicalNodeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

/**
 * Group an arm's records by the canonical name of the node they belong to,
 * deduping by record id. Records whose node is missing from the snapshot are
 * dropped — they cannot be attributed to a comparable node.
 */
function groupByNode(snapshot: ArmSnapshot): Map<string, string[]> {
  const nodeNameById = new Map<string, string>();
  for (const node of snapshot.nodes) {
    nodeNameById.set(node.id, canonicalNodeName(node.name));
  }

  const seen = new Set<string>();
  const grouped = new Map<string, string[]>();
  for (const record of snapshot.records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    const nodeName = nodeNameById.get(record.node);
    if (!nodeName) continue;
    const bucket = grouped.get(nodeName);
    if (bucket) bucket.push(normalizeText(record.text));
    else grouped.set(nodeName, [normalizeText(record.text)]);
  }
  return grouped;
}

function countDistinctRecords(snapshot: ArmSnapshot): number {
  return new Set(snapshot.records.map(record => record.id)).size;
}

function multisetDifference(left: string[], right: string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of right) counts.set(text, (counts.get(text) ?? 0) + 1);
  const out: string[] = [];
  for (const text of left) {
    const remaining = counts.get(text) ?? 0;
    if (remaining > 0) counts.set(text, remaining - 1);
    else out.push(text);
  }
  return out;
}

/**
 * Compare two arms' knowledge by content.
 *
 * Under a node present in both arms, records that appear in only one side are
 * paired up as `changed` (a record whose text the other arm wrote differently);
 * whatever is left over after pairing is a genuine `added` or `removed`. This
 * is what makes a prompt change visible when both arms produce the same node
 * names and the same record counts but different knowledge underneath.
 *
 * A node present in only one arm contributes ALL of its records to the
 * `added` (only in B) or `removed` (only in A) totals — a node the other arm
 * never wrote is knowledge the other arm does not have, and hiding its records
 * from the totals would make a large divergence look like a small one.
 */
export function diffArms(a: ArmSnapshot, b: ArmSnapshot): KnowledgeDiff {
  const aByNode = groupByNode(a);
  const bByNode = groupByNode(b);

  const aNames = new Set(a.nodes.map(node => canonicalNodeName(node.name)));
  const bNames = new Set(b.nodes.map(node => canonicalNodeName(node.name)));

  const onlyInA = [...aNames].filter(name => !bNames.has(name)).sort();
  const onlyInB = [...bNames].filter(name => !aNames.has(name)).sort();
  const matchedNodes = [...aNames].filter(name => bNames.has(name)).sort();

  const perNode: NodeRecordDiff[] = [];

  for (const node of matchedNodes) {
    const aTexts = aByNode.get(node) ?? [];
    const bTexts = bByNode.get(node) ?? [];
    const onlyA = multisetDifference(aTexts, bTexts);
    const onlyB = multisetDifference(bTexts, aTexts);

    const changedCount = Math.min(onlyA.length, onlyB.length);
    const changed = onlyA.slice(0, changedCount).map((text, index) => ({ a: text, b: onlyB[index]! }));
    const removed = onlyA.slice(changedCount);
    const added = onlyB.slice(changedCount);
    if (changed.length === 0 && removed.length === 0 && added.length === 0) continue;

    perNode.push({ node, presence: 'both', added, removed, changed });
  }

  for (const node of onlyInA) {
    perNode.push({ node, presence: 'only-a', added: [], removed: aByNode.get(node) ?? [], changed: [] });
  }
  for (const node of onlyInB) {
    perNode.push({ node, presence: 'only-b', added: bByNode.get(node) ?? [], removed: [], changed: [] });
  }

  let addedRecords = 0;
  let removedRecords = 0;
  let changedRecords = 0;
  for (const entry of perNode) {
    addedRecords += entry.added.length;
    removedRecords += entry.removed.length;
    changedRecords += entry.changed.length;
  }

  return {
    aNodeCount: aNames.size,
    bNodeCount: bNames.size,
    aRecordCount: countDistinctRecords(a),
    bRecordCount: countDistinctRecords(b),
    onlyInA,
    onlyInB,
    matchedNodes,
    perNode,
    addedRecords,
    removedRecords,
    changedRecords,
  };
}
