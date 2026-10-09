import type {
  KnowledgeImporterAccess,
  KnowledgeImporterDefinition,
  KnowledgeImporterHandle,
  KnowledgeImporterRole,
  KnowledgeImporterTriggers,
} from './types';

function assertNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string') throw new Error(`Knowledge importer ${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Knowledge importer ${label} is required`);
  return trimmed;
}

function normalizeRole(role: KnowledgeImporterRole, address: string): KnowledgeImporterRole {
  if (role !== 'readonly' && role !== 'append' && role !== 'edit' && role !== 'owner') {
    throw new Error(`Unsupported Knowledge importer role for ${address}: ${role as string}`);
  }
  return role;
}

function normalizeAccess(access: KnowledgeImporterAccess | undefined): KnowledgeImporterAccess | undefined {
  if (access === undefined) return undefined;
  if (!access || typeof access !== 'object' || Array.isArray(access)) {
    throw new Error('Knowledge importer access must be a scope-address map');
  }

  const entries = Object.entries(access).map(([address, role]) => {
    const normalizedAddress = assertNonEmpty(address, 'access scope address');
    return [normalizedAddress, normalizeRole(role, normalizedAddress)] as const;
  });
  const addresses = new Set<string>();
  for (const [address] of entries) {
    if (addresses.has(address))
      throw new Error(`Knowledge importer access scope ${address} is declared more than once`);
    addresses.add(address);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function normalizeCron(cron: KnowledgeImporterTriggers['cron']): KnowledgeImporterTriggers['cron'] {
  if (cron === undefined) return undefined;
  if (typeof cron === 'string') return assertNonEmpty(cron, 'cron trigger');
  if (!Array.isArray(cron) || cron.length === 0) throw new Error('Knowledge importer cron trigger cannot be empty');
  return Object.freeze(cron.map((entry, index) => assertNonEmpty(entry, `cron trigger[${index}]`)));
}

function normalizeTriggers(triggers: KnowledgeImporterTriggers | undefined): KnowledgeImporterTriggers {
  if (triggers === undefined) return Object.freeze({});
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) {
    throw new Error('Knowledge importer triggers must be an object');
  }
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

export class KnowledgeImporterRegistry {
  #byId = new Map<string, KnowledgeImporterHandle>();

  register<TPayload = unknown>(definition: KnowledgeImporterDefinition<TPayload>): KnowledgeImporterHandle<TPayload> {
    if (!definition || typeof definition !== 'object') throw new Error('Knowledge importer definition is required');
    const id = assertNonEmpty(definition.id, 'id');
    if (this.#byId.has(id)) throw new Error(`Knowledge importer ${id} is already registered`);
    if (typeof definition.handler !== 'function') throw new Error(`Knowledge importer ${id} handler is required`);
    if (definition.canCreateRoots !== undefined && typeof definition.canCreateRoots !== 'boolean') {
      throw new Error(`Knowledge importer ${id} canCreateRoots must be a boolean`);
    }

    const access = normalizeAccess(definition.access);
    const triggers = normalizeTriggers(definition.triggers);
    const normalized: KnowledgeImporterDefinition<TPayload> = Object.freeze({
      id,
      ...(access === undefined ? {} : { access }),
      ...(definition.canCreateRoots ? { canCreateRoots: true } : {}),
      triggers,
      handler: definition.handler,
    });
    const handle: KnowledgeImporterHandle<TPayload> = Object.freeze({
      definition: normalized,
      importerId: id,
      access,
      canCreateRoots: definition.canCreateRoots ?? false,
      triggers,
      handler: definition.handler,
      programmatic: true,
      webhookPath: webhookPath(id, triggers),
    });
    this.#byId.set(id, handle as KnowledgeImporterHandle);
    return handle;
  }

  get(id: string): KnowledgeImporterHandle | undefined {
    return this.#byId.get(id);
  }

  list(): KnowledgeImporterHandle[] {
    return [...this.#byId.values()];
  }
}
