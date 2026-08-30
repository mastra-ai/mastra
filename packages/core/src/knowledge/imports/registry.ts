import { knowledgeImporterBindingKey } from '../../storage/domains/knowledge';
import { validateCron } from '../../workflows/scheduler/cron';
import type {
  KnowledgeImporterAccess,
  KnowledgeImporterAgentConfig,
  KnowledgeImporterBindingInput,
  KnowledgeImporterCronTrigger,
  KnowledgeImporterDefinition,
  KnowledgeImporterHandle,
  KnowledgeImporterRole,
  KnowledgeImporterTriggers,
  KnowledgeImporterWebhookTrigger,
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

function normalizeBinding(binding: KnowledgeImporterBindingInput, label: string): KnowledgeImporterBindingInput {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error(`Knowledge importer ${label} must be an object`);
  }
  const normalized = Object.freeze({
    source: assertNonEmpty(binding.source, `${label} source`),
    scope: assertNonEmpty(binding.scope, `${label} scope`),
  });
  knowledgeImporterBindingKey(normalized);
  return normalized;
}

function normalizeBindings(
  bindings: readonly KnowledgeImporterBindingInput[] | undefined,
  label: string,
): readonly KnowledgeImporterBindingInput[] {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new Error(`Knowledge importer ${label} bindings cannot be empty`);
  }
  const normalized = bindings.map((binding, index) => normalizeBinding(binding, `${label} binding[${index}]`));
  const keys = new Set<string>();
  for (const binding of normalized) {
    const key = knowledgeImporterBindingKey(binding);
    if (keys.has(key)) throw new Error(`Knowledge importer ${label} binding is declared more than once: ${key}`);
    keys.add(key);
  }
  return Object.freeze(normalized);
}

function normalizeSchedule(schedule: KnowledgeImporterCronTrigger['schedule']): string | readonly string[] {
  if (typeof schedule === 'string') {
    const expression = assertNonEmpty(schedule, 'cron schedule');
    validateCron(expression);
    return expression;
  }
  if (!Array.isArray(schedule) || schedule.length === 0) {
    throw new Error('Knowledge importer cron schedule cannot be empty');
  }
  return Object.freeze(
    schedule.map((entry, index) => {
      const expression = assertNonEmpty(entry, `cron schedule[${index}]`);
      validateCron(expression);
      return expression;
    }),
  );
}

function normalizeCron(cron: KnowledgeImporterTriggers['cron']): KnowledgeImporterCronTrigger | undefined {
  if (cron === undefined) return undefined;
  if (!cron || typeof cron !== 'object' || Array.isArray(cron)) {
    throw new Error('Knowledge importer cron trigger must be an object');
  }
  return Object.freeze({
    schedule: normalizeSchedule(cron.schedule),
    bindings: normalizeBindings(cron.bindings, 'cron'),
  });
}

function normalizeWebhook(webhook: KnowledgeImporterTriggers['webhook']): KnowledgeImporterWebhookTrigger | undefined {
  if (webhook === undefined) return undefined;
  if (!webhook || typeof webhook !== 'object' || Array.isArray(webhook)) {
    throw new Error('Knowledge importer webhook trigger must be an object');
  }
  const bindings = normalizeBindings(webhook.bindings, 'webhook');
  if (webhook.resolveBinding !== undefined && typeof webhook.resolveBinding !== 'function') {
    throw new Error('Knowledge importer webhook resolveBinding must be a function');
  }
  if (bindings.length > 1 && !webhook.resolveBinding) {
    throw new Error('Knowledge importer webhook triggers with multiple bindings require resolveBinding');
  }
  return Object.freeze({
    bindings,
    ...(webhook.resolveBinding ? { resolveBinding: webhook.resolveBinding } : {}),
  });
}

function normalizeTriggers(triggers: KnowledgeImporterTriggers | undefined): KnowledgeImporterTriggers {
  if (triggers === undefined) return Object.freeze({});
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) {
    throw new Error('Knowledge importer triggers must be an object');
  }
  const unknownKeys = Object.keys(triggers).filter(key => key !== 'cron' && key !== 'webhook');
  if (unknownKeys.length) throw new Error(`Unsupported Knowledge importer trigger: ${unknownKeys[0]}`);
  const cron = normalizeCron(triggers.cron);
  const webhook = normalizeWebhook(triggers.webhook);
  return Object.freeze({
    ...(cron ? { cron } : {}),
    ...(webhook ? { webhook } : {}),
  });
}

function normalizeAgentic(agentic: KnowledgeImporterAgentConfig | undefined): KnowledgeImporterAgentConfig | undefined {
  if (agentic === undefined) return undefined;
  if (!agentic || typeof agentic !== 'object' || Array.isArray(agentic)) {
    throw new Error('Knowledge importer agentic configuration must be an object');
  }
  if (!agentic.agent || typeof agentic.agent.generate !== 'function' || typeof agentic.agent.getMemory !== 'function') {
    throw new Error('Knowledge importer agentic configuration requires an Agent');
  }
  if (agentic.maxSteps !== undefined && (!Number.isInteger(agentic.maxSteps) || agentic.maxSteps < 1)) {
    throw new Error('Knowledge importer agentic maxSteps must be a positive integer');
  }
  return Object.freeze({
    agent: agentic.agent,
    ...(agentic.maxSteps === undefined ? {} : { maxSteps: agentic.maxSteps }),
  });
}

function webhookPath(id: string, triggers: KnowledgeImporterTriggers): KnowledgeImporterHandle['webhookPath'] {
  if (!triggers.webhook) return undefined;
  return instanceKey =>
    `/api/knowledge/${encodeURIComponent(assertNonEmpty(instanceKey, 'instance key'))}/importers/${encodeURIComponent(id)}/webhook`;
}

export class KnowledgeImporterRegistry {
  #byId = new Map<string, KnowledgeImporterHandle>();

  register<TPayload = unknown>(
    definition: KnowledgeImporterDefinition<TPayload>,
    run: KnowledgeImporterHandle<TPayload>['run'] = async () => {
      throw new Error(`Knowledge importer ${definition.id} is not attached to a Knowledge runtime`);
    },
  ): KnowledgeImporterHandle<TPayload> {
    if (!definition || typeof definition !== 'object') throw new Error('Knowledge importer definition is required');
    const id = assertNonEmpty(definition.id, 'id');
    if (this.#byId.has(id)) throw new Error(`Knowledge importer ${id} is already registered`);
    if (typeof definition.handler !== 'function') throw new Error(`Knowledge importer ${id} handler is required`);
    if (definition.canCreateRoots !== undefined && typeof definition.canCreateRoots !== 'boolean') {
      throw new Error(`Knowledge importer ${id} canCreateRoots must be a boolean`);
    }

    const access = normalizeAccess(definition.access);
    const triggers = normalizeTriggers(definition.triggers);
    const agentic = normalizeAgentic(definition.agentic);
    const normalized: KnowledgeImporterDefinition<TPayload> = Object.freeze({
      id,
      ...(access === undefined ? {} : { access }),
      ...(definition.canCreateRoots ? { canCreateRoots: true } : {}),
      triggers,
      ...(agentic ? { agentic } : {}),
      handler: definition.handler,
    });
    const handle: KnowledgeImporterHandle<TPayload> = Object.freeze({
      definition: normalized,
      importerId: id,
      access,
      canCreateRoots: definition.canCreateRoots ?? false,
      triggers,
      ...(agentic ? { agentic } : {}),
      handler: definition.handler,
      programmatic: true,
      webhookPath: webhookPath(id, triggers),
      run,
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
