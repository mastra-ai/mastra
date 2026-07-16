import { createHash } from 'node:crypto';

import type { ProcessorContext, ProcessorStreamWriter } from '@mastra/core/processors';
import type {
  KnowledgeActivityEvent,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeStorage,
} from '@mastra/core/storage';
import { isKnowledgeScopeVisible } from '@mastra/core/storage';

export const SUBCONSCIOUS_ACTIVITY_STATE_ID = 'subconscious-activity';

export interface SubconsciousActivityUpdate {
  id: string;
  action: KnowledgeActivityEvent['action'];
  type: KnowledgeSemanticDocumentType;
  recordId: string;
  name?: string;
  targetId: string;
  targetType: 'entity' | 'page';
  sourceThreadId?: string;
  createdAt: string;
}

export interface SubconsciousActivitySnapshot {
  updates: SubconsciousActivityUpdate[];
  hot: Array<{ type: 'entity' | 'page'; id: string; name: string; updates: number }>;
  errors?: string[];
}

async function getActivityTarget(
  store: KnowledgeStorage,
  event: KnowledgeActivityEvent,
  scope: KnowledgeScope,
): Promise<{ id: string; name?: string; type: 'entity' | 'page' }> {
  if (event.recordType === 'entity') {
    const entity = await store.getEntity(event.recordId);
    return {
      id: event.recordId,
      name: entity && isKnowledgeScopeVisible(entity.scope, scope) ? entity.name : undefined,
      type: 'entity',
    };
  }
  if (event.recordType === 'page') {
    const page = await store.getPage(event.recordId);
    return {
      id: event.recordId,
      name: page && isKnowledgeScopeVisible(page.scope, scope) ? page.name : undefined,
      type: 'page',
    };
  }
  const fact = await store.getFact({ id: event.recordId, includeDeleted: true });
  const entity = fact ? await store.getEntity(fact.parentEntityId) : undefined;
  if (!entity || !isKnowledgeScopeVisible(entity.scope, scope)) {
    return { id: event.recordId, type: 'entity' };
  }
  return { id: entity.id, name: entity.name, type: 'entity' };
}

export async function buildSubconsciousActivitySnapshot(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  recentUpdates: number;
  errors?: string[];
}): Promise<SubconsciousActivitySnapshot> {
  const events = await input.store.listActivity({ scope: input.scope, limit: input.recentUpdates });
  const updates = await Promise.all(
    events.map(async event => {
      const target = await getActivityTarget(input.store, event, input.scope);
      return {
        id: event.id,
        action: event.action,
        type: event.recordType,
        recordId: event.recordId,
        name: target.name,
        targetId: target.id,
        targetType: target.type,
        sourceThreadId: event.sourceThreadId,
        createdAt: event.createdAt.toISOString(),
      };
    }),
  );
  const hotByRecord = new Map<string, { type: 'entity' | 'page'; id: string; name: string; updates: number }>();
  for (const update of updates) {
    if (!update.name) continue;
    const key = `${update.targetType}:${update.targetId}`;
    const existing = hotByRecord.get(key);
    if (existing) existing.updates += 1;
    else {
      hotByRecord.set(key, {
        type: update.targetType,
        id: update.targetId,
        name: update.name,
        updates: 1,
      });
    }
  }
  const hot = [...hotByRecord.values()]
    .sort((a, b) => b.updates - a.updates || a.name.localeCompare(b.name))
    .slice(0, input.recentUpdates);
  const errors = input.errors?.filter(Boolean).slice(0, input.recentUpdates);
  return { updates, hot, ...(errors?.length ? { errors } : {}) };
}

export function renderSubconsciousActivity(snapshot: SubconsciousActivitySnapshot): string {
  const lines = snapshot.updates.map(update => {
    const target = update.name ? `${update.type} [[${update.name}]]` : `${update.type} (details unavailable)`;
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
    cacheKey: createHash('sha256').update(contents).digest('hex'),
    tagName: 'state',
    attributes: { id: SUBCONSCIOUS_ACTIVITY_STATE_ID },
    metadata: { origin: 'subconscious' },
    contents,
    value: snapshot,
  });
}

export async function publishSubconsciousActivity(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  recentUpdates: number;
  sendStateSignal?: ProcessorContext['sendStateSignal'];
  errors?: string[];
}): Promise<SubconsciousActivitySnapshot | undefined> {
  if (!input.sendStateSignal) return undefined;
  const snapshot = await buildSubconsciousActivitySnapshot(input);
  const contents = renderSubconsciousActivity(snapshot);
  const cacheKey = createHash('sha256').update(contents).digest('hex');
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
