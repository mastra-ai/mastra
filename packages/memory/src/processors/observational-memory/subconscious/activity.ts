import { getKnowledgeReadableScopeIds, isKnowledgeReadVisible } from '@mastra/core/knowledge';
import type { Knowledge } from '@mastra/core/knowledge';
import type { ProcessorContext, ProcessorStreamWriter } from '@mastra/core/processors';
import type {
  KnowledgeActivityEvent,
  KnowledgeScopeIds,
  KnowledgeSemanticDocumentType,
  KnowledgeStorage,
} from '@mastra/core/storage';

export const SUBCONSCIOUS_ACTIVITY_STATE_ID = 'subconscious-activity';

async function hashContents(contents: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(contents));
  return Buffer.from(digest).toString('hex');
}

export interface SubconsciousActivityUpdate {
  action: KnowledgeActivityEvent['action'];
  type: KnowledgeSemanticDocumentType;
  name?: string;
  createdAt: string;
}

export interface SubconsciousActivitySnapshot {
  updates: SubconsciousActivityUpdate[];
  hot: Array<{ type: 'node'; name: string; updates: number }>;
  errors?: string[];
}

async function getActivityTarget(
  store: KnowledgeStorage,
  event: KnowledgeActivityEvent,
  readableScopeIds: KnowledgeScopeIds,
): Promise<{ id: string; name?: string; type: 'node' } | null> {
  let nodeId = event.targetId;
  if (event.targetType !== 'node') {
    const record = await store.getVisibleRecord({
      id: event.targetId,
      scopeIds: readableScopeIds,
      includeDeleted: true,
    });
    if (!record) return null;
    nodeId = record.nodeId;
  }
  const node = await store.getNode(nodeId);
  if (!node || node.isScope) return null;
  if (!isKnowledgeReadVisible(await store.getNodeScopeIds(node.id), readableScopeIds)) return null;
  return { id: node.id, name: node.name, type: 'node' };
}

/**
 * Activity is read with the session's ordinary authority: the resource and thread rungs are vouched
 * (the org rung never is), and only scopes the evaluated grants make readable contribute events,
 * records, or node names.
 */
export async function buildSubconsciousActivitySnapshot(input: {
  knowledge: Knowledge;
  scopeIds: KnowledgeScopeIds;
  recentUpdates: number;
  errors?: string[];
}): Promise<SubconsciousActivitySnapshot> {
  const store = await input.knowledge.getStorageInternal();
  const readableScopeIds = getKnowledgeReadableScopeIds(await input.knowledge.evaluateAccess(input.scopeIds.slice(1)));
  const events = readableScopeIds.length
    ? await store.listActivity({ scopeIds: readableScopeIds, limit: Math.min(input.recentUpdates * 2, 100) })
    : [];
  const resolvedUpdates = (
    await Promise.all(
      events.map(async event => {
        const target = await getActivityTarget(store, event, readableScopeIds);
        if (!target) return null;
        return {
          action: event.action,
          type: event.targetType,
          name: target.name,
          targetId: target.id,
          targetType: target.type,
          createdAt: event.createdAt.toISOString(),
        };
      }),
    )
  ).filter(update => update !== null);
  resolvedUpdates.splice(input.recentUpdates);
  const hotByRecord = new Map<string, { type: 'node'; name: string; updates: number }>();
  for (const update of resolvedUpdates) {
    if (!update.name) continue;
    const key = `${update.targetType}:${update.targetId}`;
    const existing = hotByRecord.get(key);
    if (existing) existing.updates += 1;
    else {
      hotByRecord.set(key, {
        type: update.targetType,
        name: update.name,
        updates: 1,
      });
    }
  }
  const hot = [...hotByRecord.values()]
    .sort((a, b) => b.updates - a.updates || a.name.localeCompare(b.name))
    .slice(0, input.recentUpdates);
  const updates = resolvedUpdates.map(update => ({
    action: update.action,
    type: update.type,
    ...(update.name ? { name: update.name } : {}),
    createdAt: update.createdAt,
  }));
  const errors = input.errors?.filter(Boolean).slice(0, input.recentUpdates);
  return { updates, hot, ...(errors?.length ? { errors } : {}) };
}

export function renderSubconsciousActivity(snapshot: SubconsciousActivitySnapshot): string {
  const lines = snapshot.updates.map(update => {
    const target = update.name ? `${update.type} [[${update.name}]]` : update.type;
    return `- ${update.action}: ${target}`;
  });
  const hot = snapshot.hot.map(record => `[[${record.name}]] (${record.updates})`).join(', ');
  return [
    hot ? `Hot: ${hot}` : 'Hot: none',
    'Recent updates:',
    ...(lines.length ? lines : ['- none']),
    ...(snapshot.errors?.length ? ['Errors:', ...snapshot.errors.map(error => `- ${error}`)] : []),
  ].join('\n');
}

export async function publishSubconsciousError(input: {
  error: string;
  agent?: string;
  sendStateSignal?: ProcessorContext['sendStateSignal'];
  writer?: ProcessorStreamWriter;
}): Promise<void> {
  await input.writer?.custom({
    type: 'data-subconscious-error',
    data: { error: input.error, agent: input.agent },
  });
  if (!input.sendStateSignal) return;
  const snapshot: SubconsciousActivitySnapshot = { updates: [], hot: [], errors: [input.error] };
  const contents = renderSubconsciousActivity(snapshot);
  await input.sendStateSignal({
    id: SUBCONSCIOUS_ACTIVITY_STATE_ID,
    mode: 'snapshot',
    cacheKey: await hashContents(contents),
    tagName: 'state',
    attributes: { id: SUBCONSCIOUS_ACTIVITY_STATE_ID },
    metadata: { origin: 'subconscious' },
    contents,
    value: snapshot,
  });
}

export async function publishSubconsciousActivity(input: {
  knowledge: Knowledge;
  scopeIds: KnowledgeScopeIds;
  recentUpdates: number;
  sendStateSignal?: ProcessorContext['sendStateSignal'];
  errors?: string[];
}): Promise<SubconsciousActivitySnapshot | undefined> {
  if (!input.sendStateSignal) return undefined;
  const snapshot = await buildSubconsciousActivitySnapshot(input);
  const contents = renderSubconsciousActivity(snapshot);
  const cacheKey = await hashContents(contents);
  await input.sendStateSignal({
    id: SUBCONSCIOUS_ACTIVITY_STATE_ID,
    mode: 'snapshot',
    cacheKey,
    tagName: 'state',
    attributes: { id: SUBCONSCIOUS_ACTIVITY_STATE_ID },
    metadata: { origin: 'subconscious' },
    contents,
    value: snapshot,
  });
  return snapshot;
}
