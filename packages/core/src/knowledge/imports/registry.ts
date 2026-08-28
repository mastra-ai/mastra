import type {
  KnowledgeImporterDefinition,
  KnowledgeImporterHandle,
  KnowledgeImporterSourceIdentity,
  KnowledgeImporterTriggers,
} from './types';

function assertNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string') throw new Error(`Knowledge importer ${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Knowledge importer ${label} is required`);
  return trimmed;
}

function normalizeScope(scope: readonly string[]): ReadonlyArray<string> {
  if (!Array.isArray(scope) || scope.length === 0) throw new Error('Knowledge importer scope is required');
  return Object.freeze(scope.map((entry, index) => assertNonEmpty(entry, `scope[${index}]`)));
}

function normalizeSource(source: KnowledgeImporterSourceIdentity): KnowledgeImporterSourceIdentity {
  return Object.freeze({
    type: assertNonEmpty(source.type, 'source.type'),
    id: assertNonEmpty(source.id, 'source.id'),
  });
}

function sourceKey(source: KnowledgeImporterSourceIdentity): string {
  return JSON.stringify([source.type, source.id]);
}

function normalizeCron(cron: KnowledgeImporterTriggers['cron']): KnowledgeImporterTriggers['cron'] {
  if (cron === undefined) return undefined;
  if (typeof cron === 'string') return assertNonEmpty(cron, 'cron trigger');
  if (!Array.isArray(cron) || cron.length === 0) throw new Error('Knowledge importer cron trigger cannot be empty');
  return Object.freeze(cron.map((entry, index) => assertNonEmpty(entry, `cron trigger[${index}]`)));
}

function normalizeTriggers(triggers: KnowledgeImporterTriggers | undefined): KnowledgeImporterTriggers {
  if (!triggers) return Object.freeze({});
  const unknownKeys = Object.keys(triggers).filter(key => key !== 'cron' && key !== 'webhook');
  if (unknownKeys.length) throw new Error(`Unsupported Knowledge importer trigger: ${unknownKeys[0]}`);
  if (triggers.webhook !== undefined && triggers.webhook !== true) {
    throw new Error('Knowledge importer webhook trigger must be true when provided');
  }
  const cron = normalizeCron(triggers.cron);
  return Object.freeze({
    ...(cron === undefined ? {} : { cron }),
    ...(triggers.webhook ? { webhook: true as const } : {}),
  });
}

function webhookPath(id: string, triggers: KnowledgeImporterTriggers): KnowledgeImporterHandle['webhookPath'] {
  if (!triggers.webhook) return undefined;
  return instanceKey =>
    `/api/knowledge/${encodeURIComponent(assertNonEmpty(instanceKey, 'instance key'))}/importers/${encodeURIComponent(id)}/webhook`;
}

/** @experimental Knowledge importer APIs are experimental and may change without notice. */
export class KnowledgeImporterRegistry {
  #byId = new Map<string, KnowledgeImporterHandle>();
  #sourceToId = new Map<string, string>();

  register(definition: KnowledgeImporterDefinition): KnowledgeImporterHandle {
    const id = assertNonEmpty(definition.id, 'id');
    if (this.#byId.has(id)) throw new Error(`Knowledge importer ${id} is already registered`);
    if (definition.kind !== 'static' && definition.kind !== 'agentic') {
      throw new Error(`Unsupported Knowledge importer kind: ${definition.kind as string}`);
    }
    if (definition.role !== 'append' && definition.role !== 'edit' && definition.role !== 'owner') {
      throw new Error(`Unsupported Knowledge importer role: ${definition.role as string}`);
    }

    const source = normalizeSource(definition.source);
    const key = sourceKey(source);
    const existing = this.#sourceToId.get(key);
    if (existing) throw new Error(`Knowledge importer source ${key} is already registered by ${existing}`);

    const scope = normalizeScope(definition.scope);
    const triggers = normalizeTriggers(definition.triggers);
    const normalized: KnowledgeImporterDefinition = Object.freeze({
      id,
      source,
      kind: definition.kind,
      scope,
      role: definition.role,
      triggers,
    });
    const handle: KnowledgeImporterHandle = Object.freeze({
      definition: normalized,
      importerId: id,
      source,
      sourceKey: key,
      kind: normalized.kind,
      scope,
      role: normalized.role,
      triggers,
      programmatic: true,
      webhookPath: webhookPath(id, triggers),
    });
    this.#byId.set(id, handle);
    this.#sourceToId.set(key, id);
    return handle;
  }

  get(id: string): KnowledgeImporterHandle | undefined {
    return this.#byId.get(id);
  }

  list(): KnowledgeImporterHandle[] {
    return [...this.#byId.values()];
  }
}
