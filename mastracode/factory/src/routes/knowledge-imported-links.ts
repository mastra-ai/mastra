import type { KnowledgeImportClaim, KnowledgeNode, KnowledgeRecord, KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgeUnsupportedError } from '@mastra/core/storage';

const MAX_ITEMS = 100;
const MAX_INDEX_ENTRIES = 20_000;

/** Maximum in-flight store reads while prefetching claims and scope placements. */
export const IMPORTED_LINKS_PREFETCH_CONCURRENCY = 8;

export interface ImportedLinkSuppression {
  /** Withheld because a node/index/record budget stopped projection on overflow. */
  budget?: number;
  /** Withheld because the only provenance is a scope-less retirement marker. */
  retired?: number;
  /** Withheld because more than one candidate matched. */
  ambiguous?: number;
  /** Withheld because the storage adapter cannot serve importer claims. */
  unsupported?: number;
}

export interface ImportedLinkReport {
  complete: boolean;
  /** Counts metadata relationships withheld by cause. Absent keys mean zero. */
  suppressed: ImportedLinkSuppression;
}

export interface ImportedGraphProjection {
  targets: Map<string, KnowledgeNode[]>;
  report: ImportedLinkReport;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identity(claim: KnowledgeImportClaim): string {
  return JSON.stringify([claim.importerId, claim.source, claim.binding]);
}

interface Candidate {
  node: KnowledgeNode;
  scopeIds: readonly string[];
  /** The claim behind this candidate is a scope-less retirement marker. */
  marked: boolean;
}

interface Placement {
  scopeIds: readonly string[];
  /** The claim behind this placement is a scope-less retirement marker. */
  marked: boolean;
}

/**
 * Valid-shaped relationship links on a record. Malformed entries were never projected, so they are
 * not relationships withheld by cause and stay uncounted.
 */
function linkCount(record: KnowledgeRecord): number {
  const links = record.metadata?.links;
  if (!Array.isArray(links)) return 0;
  let count = 0;
  for (const link of links) {
    if (!object(link)) continue;
    const value = Object.hasOwn(link, 'address') ? link.address : link.name;
    if (typeof value === 'string' && value.trim()) count += 1;
  }
  return count;
}

/** Runs one read per item with a bounded number in flight; consumers stay sequential. */
async function prefetchBatched<T>(items: readonly T[], read: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += IMPORTED_LINKS_PREFETCH_CONCURRENCY) {
    await Promise.all(items.slice(start, start + IMPORTED_LINKS_PREFETCH_CONCURRENCY).map(item => read(item)));
  }
}

/** Project only complete, visible importer identities; never fall back to global name/address resolution. */
export async function importedGraphTargets(
  store: KnowledgeStorage,
  nodes: KnowledgeNode[],
  records: KnowledgeRecord[],
): Promise<ImportedGraphProjection> {
  const result = new Map<string, KnowledgeNode[]>();
  if (!records.some(record => Array.isArray(record.metadata?.links))) {
    return { targets: result, report: { complete: true, suppressed: {} } };
  }
  const report: ImportedLinkReport = { complete: true, suppressed: {} };
  const withhold = (cause: keyof ImportedLinkSuppression, count: number) => {
    if (count > 0) {
      report.suppressed[cause] = (report.suppressed[cause] ?? 0) + count;
      report.complete = false;
    }
  };
  // Whole-request budget stops withhold every relationship in the window, so they count up front.
  const allLinks = (): number => records.reduce((sum, record) => sum + linkCount(record), 0);
  const budgetStop = (): ImportedGraphProjection => {
    withhold('budget', allLinks());
    return { targets: new Map(), report };
  };
  const index = new Map<string, Map<string, Candidate>>();
  const nodeClaims = new Map<string, Map<string, Placement>>();
  try {
    const claimLists = new Map<string, KnowledgeImportClaim[]>();
    const scopeIdsById = new Map<string, readonly string[]>();
    await prefetchBatched(nodes, async node => {
      claimLists.set(node.id, await store.listImportClaims({ targetType: 'node', targetId: node.id }));
      scopeIdsById.set(node.id, await store.getNodeScopeIds(node.id));
    });
    let entries = 0;
    for (const node of nodes) {
      const claims = claimLists.get(node.id)!;
      const aliases = node.metadata?.addressAliases;
      // A partial index could hide a collision and incorrectly resolve an ambiguous address.
      if (claims.length > MAX_ITEMS || (Array.isArray(aliases) && aliases.length > MAX_ITEMS)) return budgetStop();
      const placements = new Map<string, Placement>();
      nodeClaims.set(node.id, placements);
      const scopeIds = scopeIdsById.get(node.id)!;
      const addresses = [node.metadata?.address, ...(Array.isArray(aliases) ? aliases : [])]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim());
      for (const claim of claims) {
        if (claim.version !== node.version) continue;
        // A retirement marker preserves provenance, not evidence of contributed placement.
        const placement: Placement = {
          scopeIds: scopeIds.filter(id => claim.scopeIds.includes(id)),
          marked: claim.scopeIds.length === 0,
        };
        placements.set(identity(claim), placement);
        const candidate: Candidate = { node, scopeIds: placement.scopeIds, marked: placement.marked };
        for (const key of new Set([
          ...addresses.map(address => JSON.stringify([identity(claim), 'address', address])),
          JSON.stringify([identity(claim), 'name', node.name.trim().toLocaleLowerCase()]),
        ])) {
          if (++entries > MAX_INDEX_ENTRIES) return budgetStop();
          const bucket = index.get(key) ?? new Map<string, Candidate>();
          bucket.set(node.id, candidate);
          index.set(key, bucket);
        }
      }
    }
    const projectable: Array<{ record: KnowledgeRecord; links: unknown[] }> = [];
    for (const record of records) {
      const links = record.metadata?.links;
      if (!Array.isArray(links) || links.length > MAX_ITEMS) {
        withhold('budget', linkCount(record));
        continue;
      }
      projectable.push({ record, links });
    }
    const recordClaims = new Map<string, KnowledgeImportClaim[]>();
    const recordScopes = new Map<string, readonly string[]>();
    await prefetchBatched(projectable, async ({ record }) => {
      recordClaims.set(record.id, await store.listImportClaims({ targetType: 'record', targetId: record.id }));
      recordScopes.set(record.id, await store.getRecordScopeIds(record.id));
    });
    for (const { record, links } of projectable) {
      const claims = recordClaims.get(record.id)!;
      if (claims.length > MAX_ITEMS) {
        withhold('budget', linkCount(record));
        continue;
      }
      const scopeIds = recordScopes.get(record.id)!;
      const originClaims = nodeClaims.get(record.nodeId);
      const targets = new Map<string, KnowledgeNode>();
      for (const link of links) {
        if (!object(link)) continue;
        const byAddress = Object.hasOwn(link, 'address');
        const value = byAddress ? link.address : link.name;
        if (typeof value !== 'string' || !value.trim()) continue;
        const label = byAddress ? value.trim() : value.trim().toLocaleLowerCase();
        const matches = new Map<string, KnowledgeNode>();
        let retiredContribution = false;
        for (const claim of claims) {
          if (claim.version !== record.version || claim.source !== record.source) continue;
          const originPlacement = originClaims?.get(identity(claim));
          if (!originPlacement) continue;
          for (const candidate of index
            .get(JSON.stringify([identity(claim), byAddress ? 'address' : 'name', label]))
            ?.values() ?? []) {
            // A retirement marker on the record's, origin's or target's claim means the candidate
            // resolved but its contribution cannot be proven; that withheld link is what we report.
            if (claim.scopeIds.length === 0 || originPlacement.marked || candidate.marked) {
              retiredContribution = true;
              continue;
            }
            if (
              candidate.scopeIds.some(
                id => scopeIds.includes(id) && claim.scopeIds.includes(id) && originPlacement.scopeIds.includes(id),
              )
            ) {
              matches.set(candidate.node.id, candidate.node);
            }
          }
        }
        if (matches.size === 1) {
          const target = matches.values().next().value;
          if (target && target.id !== record.nodeId) targets.set(target.id, target);
        } else if (matches.size > 1) {
          withhold('ambiguous', 1);
        } else if (retiredContribution) {
          withhold('retired', 1);
        }
      }
      result.set(record.id, [...targets.values()]);
    }
  } catch (error) {
    if (!(error instanceof KnowledgeUnsupportedError)) throw error;
    // Older/unsupported adapters still render ordinary text links without importer provenance.
    return { targets: new Map(), report: { complete: false, suppressed: { unsupported: allLinks() } } };
  }
  return { targets: result, report };
}
