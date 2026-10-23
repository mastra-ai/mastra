import type { KnowledgeImportClaim, KnowledgeNode, KnowledgeRecord, KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgeUnsupportedError } from '@mastra/core/storage';

const MAX_ITEMS = 100;
const MAX_INDEX_ENTRIES = 20_000;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identity(claim: KnowledgeImportClaim): string {
  return JSON.stringify([claim.importerId, claim.source, claim.binding]);
}

interface Candidate {
  node: KnowledgeNode;
  scopeIds: readonly string[];
}

/** Project only complete, visible importer identities; never fall back to global name/address resolution. */
export async function importedGraphTargets(
  store: KnowledgeStorage,
  nodes: KnowledgeNode[],
  records: KnowledgeRecord[],
): Promise<Map<string, KnowledgeNode[]>> {
  const result = new Map<string, KnowledgeNode[]>();
  if (!records.some(record => Array.isArray(record.metadata?.links))) return result;
  const index = new Map<string, Map<string, Candidate>>();
  const nodeClaims = new Map<string, Map<string, readonly string[]>>();
  let entries = 0;
  try {
    for (const node of nodes) {
      const claims = await store.listImportClaims({ targetType: 'node', targetId: node.id });
      const aliases = node.metadata?.addressAliases;
      // A partial index could hide a collision and incorrectly resolve an ambiguous address.
      if (claims.length > MAX_ITEMS || (Array.isArray(aliases) && aliases.length > MAX_ITEMS)) return result;
      const placements = new Map<string, readonly string[]>();
      nodeClaims.set(node.id, placements);
      const scopeIds = await store.getNodeScopeIds(node.id);
      const addresses = [node.metadata?.address, ...(Array.isArray(aliases) ? aliases : [])]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim());
      for (const claim of claims) {
        if (claim.version !== node.version) continue;
        // A retirement marker preserves provenance, not evidence of contributed placement.
        const candidate = { node, scopeIds: scopeIds.filter(id => claim.scopeIds.includes(id)) };
        placements.set(identity(claim), candidate.scopeIds);
        for (const key of new Set([
          ...addresses.map(address => JSON.stringify([identity(claim), 'address', address])),
          JSON.stringify([identity(claim), 'name', node.name.trim().toLocaleLowerCase()]),
        ])) {
          if (++entries > MAX_INDEX_ENTRIES) return result;
          const bucket = index.get(key) ?? new Map<string, Candidate>();
          bucket.set(node.id, candidate);
          index.set(key, bucket);
        }
      }
    }
    for (const record of records) {
      const links = record.metadata?.links;
      if (!Array.isArray(links) || links.length > MAX_ITEMS) continue;
      const claims = await store.listImportClaims({ targetType: 'record', targetId: record.id });
      if (claims.length > MAX_ITEMS) continue;
      const scopeIds = await store.getRecordScopeIds(record.id);
      const originClaims = nodeClaims.get(record.nodeId);
      const targets = new Map<string, KnowledgeNode>();
      for (const link of links) {
        if (!object(link)) continue;
        const byAddress = Object.hasOwn(link, 'address');
        const value = byAddress ? link.address : link.name;
        if (typeof value !== 'string' || !value.trim()) continue;
        const label = byAddress ? value.trim() : value.trim().toLocaleLowerCase();
        const matches = new Map<string, KnowledgeNode>();
        for (const claim of claims) {
          if (claim.version !== record.version || claim.source !== record.source) continue;
          const originScopes = originClaims?.get(identity(claim));
          if (!originScopes) continue;
          const candidates = index.get(JSON.stringify([identity(claim), byAddress ? 'address' : 'name', label]));
          for (const { node, scopeIds: targetScopes } of candidates?.values() ?? []) {
            if (
              targetScopes.some(id => scopeIds.includes(id) && claim.scopeIds.includes(id) && originScopes.includes(id))
            ) {
              matches.set(node.id, node);
            }
          }
        }
        if (matches.size === 1) {
          const target = matches.values().next().value;
          if (target && target.id !== record.nodeId) targets.set(target.id, target);
        }
      }
      result.set(record.id, [...targets.values()]);
    }
  } catch (error) {
    if (!(error instanceof KnowledgeUnsupportedError)) throw error;
    // Older/unsupported adapters still render ordinary text links without importer provenance.
    return new Map();
  }
  return result;
}
