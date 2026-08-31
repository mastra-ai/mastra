import { knowledgeImporterBindingKey } from '../../storage/domains/knowledge';
import type { KnowledgeNode, KnowledgeRecord } from '../../storage/domains/knowledge';
import { assertKnowledgeTargetCapability } from '../access/mutations';
import type { KnowledgeCapability } from '../access/types';
import type { Knowledge } from '../index';
import type { KnowledgeImporterBindingHandle } from './types';

export interface StaticKnowledgeNodeInput {
  readonly name: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StaticKnowledgeRecordInput {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StaticKnowledgeNodeHandle {
  readonly node: KnowledgeNode;
  readonly id: string;
  appendRecord(input: StaticKnowledgeRecordInput): Promise<KnowledgeRecord>;
  listRecords(): Promise<KnowledgeRecord[]>;
  removeRecord(id: string): Promise<KnowledgeRecord | null>;
}

export interface StaticKnowledgeImporterOperations {
  getNode(address: string): Promise<StaticKnowledgeNodeHandle | null>;
  listNodes(): Promise<StaticKnowledgeNodeHandle[]>;
  upsertNode(address: string, input: StaticKnowledgeNodeInput): Promise<StaticKnowledgeNodeHandle>;
  removeNode(address: string): Promise<{ node: KnowledgeNode; deleted: boolean } | null>;
}

/** @internal */
export async function createStaticKnowledgeImporterOperations(input: {
  knowledge: Knowledge;
  importerId: string;
  source: string;
  scopeAddress: string;
  importRunId: string;
  assertLeaseOwned?: () => Promise<void>;
}): Promise<StaticKnowledgeImporterOperations> {
  const importer = input.knowledge.getImporter(input.importerId);
  if (!importer) throw new Error(`Knowledge importer ${input.importerId} is not registered`);
  const storage = await input.knowledge.getStorageInternal();
  const scope = await storage.getScopeAddress(input.scopeAddress);
  if (!scope) throw new Error(`Knowledge importer destination scope does not exist: ${input.scopeAddress}`);

  const access = importer.access;
  const writableMatches = access
    ? Object.entries(access)
        .map(([pattern, role]) => ({ role, parameters: matchAddressPattern(pattern, input.scopeAddress) }))
        .filter(
          (match): match is { role: KnowledgeImporterBindingHandle['role']; parameters: Record<string, string> } =>
            match.parameters !== null && match.role !== 'readonly',
        )
    : [{ role: 'edit' as const, parameters: {} }];
  if (writableMatches.length === 0) {
    throw new Error(`Knowledge importer ${input.importerId} cannot write to scope ${input.scopeAddress}`);
  }
  const selected = writableMatches.sort((left, right) => roleRank(right.role) - roleRank(left.role))[0]!;
  const resolvedAccess = new Map<string, KnowledgeImporterBindingHandle['role'] | 'readonly'>([
    [scope.scopeNodeId, selected.role],
  ]);
  for (const [pattern, role] of Object.entries(access ?? {})) {
    const address = renderAddressPattern(pattern, selected.parameters);
    if (!address) continue;
    const resolved = await storage.getScopeAddress(address);
    if (!resolved) continue;
    const current = resolvedAccess.get(resolved.scopeNodeId);
    if (!current || roleRank(role) > roleRank(current)) resolvedAccess.set(resolved.scopeNodeId, role);
  }
  const binding = knowledgeImporterBindingKey({ source: input.source, scope: input.scopeAddress });
  const run = await input.knowledge.getImportRunInternal(input.importRunId);
  if (
    !run ||
    run.importerId !== input.importerId ||
    run.binding !== binding ||
    (run.importKind !== 'static' && run.importKind !== 'agentic') ||
    run.status !== 'running'
  ) {
    throw new Error(`Knowledge import run ${input.importRunId} is not active`);
  }

  const principalAddress = `importer:${input.importerId}`;
  const principalScopeId = (
    await storage.reconcileStructure({ scopes: [{ address: principalAddress, name: `Importer ${input.importerId}` }] })
  ).scopes[principalAddress]!;
  for (const [scopeNodeId, role] of resolvedAccess) {
    await storage.upsertScopeGrant({ scopeNodeId, scopeRefId: principalScopeId, role });
  }

  return new StaticKnowledgeImporterOperationsImpl({
    knowledge: input.knowledge,
    importer: {
      importerId: input.importerId,
      binding,
      source: input.source.trim(),
      scopeAddress: input.scopeAddress.trim(),
      scopeId: scope.scopeNodeId,
      principalScopeId,
      resolutionScopeIds: [...resolvedAccess.keys()],
      role: selected.role,
    },
    importRunId: input.importRunId,
    assertLeaseOwned: input.assertLeaseOwned,
  });
}

class StaticKnowledgeNodeHandleImpl implements StaticKnowledgeNodeHandle {
  readonly node: KnowledgeNode;
  readonly #address: string;
  readonly #knowledge: Knowledge;
  readonly #importer: KnowledgeImporterBindingHandle;
  readonly #importRunId: string;
  readonly #assertRunActive: () => Promise<void>;

  constructor(input: {
    address: string;
    node: KnowledgeNode;
    knowledge: Knowledge;
    importer: KnowledgeImporterBindingHandle;
    importRunId: string;
    assertRunActive: () => Promise<void>;
  }) {
    this.#address = input.address;
    this.node = input.node;
    this.#knowledge = input.knowledge;
    this.#importer = input.importer;
    this.#importRunId = input.importRunId;
    this.#assertRunActive = input.assertRunActive;
  }

  get id(): string {
    return this.node.id;
  }

  async appendRecord(input: StaticKnowledgeRecordInput): Promise<KnowledgeRecord> {
    const expectedAccessEpoch = await this.#assertMutationAllowed('append');
    return (await this.#knowledge.getStorageInternal()).createRecord({
      ...input,
      node: this.node.id,
      source: this.#importer.source,
      scopeIds: [this.#importer.scopeId],
      resolutionScopeIds: [...this.#importer.resolutionScopeIds],
      contextScopeId: this.#importer.scopeId,
      importRunId: this.#importRunId,
      expectedAccessEpoch,
    });
  }

  async listRecords(): Promise<KnowledgeRecord[]> {
    await this.#assertRunActive();
    if (!(await this.#isOwned())) return [];
    const storage = await this.#knowledge.getStorageInternal();
    const records: KnowledgeRecord[] = [];
    let after: string | undefined;
    do {
      const page = await this.#knowledge.listRecords({
        node: this.node.id,
        scopeIds: [this.#importer.principalScopeId],
        membershipScopeIds: [this.#importer.scopeId],
        after,
        limit: 100,
      });
      const owned = await Promise.all(
        page.records.map(async record => {
          if (record.source !== this.#importer.source) return null;
          const scopeIds = await storage.getRecordScopeIds(record.id);
          return isExactScope(scopeIds, this.#importer.scopeId) ? record : null;
        }),
      );
      records.push(...owned.filter((record): record is KnowledgeRecord => record !== null));
      after = page.nextCursor;
    } while (after);
    return records;
  }

  async removeRecord(id: string): Promise<KnowledgeRecord | null> {
    await this.#assertRunActive();
    if (this.#importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} requires owner authority to remove knowledge`);
    }
    const expectedAccessEpoch = await this.#assertMutationAllowed('delete');
    const storage = await this.#knowledge.getStorageInternal();
    const record = await storage.getRecord({ id, includeDeleted: true });
    if (!record) return null;
    const scopeIds = await storage.getRecordScopeIds(record.id);
    if (
      record.nodeId !== this.node.id ||
      record.source !== this.#importer.source ||
      !isExactScope(scopeIds, this.#importer.scopeId)
    ) {
      throw new Error(
        `Knowledge importer ${this.#importer.importerId} cannot remove knowledge owned by another binding`,
      );
    }
    return storage.deleteRecordBySource({
      id,
      source: this.#importer.source,
      importRunId: this.#importRunId,
      expectedAccessEpoch,
    });
  }

  async #assertMutationAllowed(capability: KnowledgeCapability): Promise<number> {
    await this.#assertRunActive();
    if (!(await this.#isOwned())) {
      throw new Error(`Knowledge node ${this.#address} is not owned by this importer binding`);
    }
    const frontier = await this.#knowledge.evaluateAccess([this.#importer.principalScopeId]);
    assertKnowledgeTargetCapability({
      frontier,
      scopeIds: [this.#importer.scopeId],
      capability,
      targetType: 'node',
      targetId: this.node.id,
    });
    return frontier.accessEpoch;
  }

  async #isOwned(): Promise<boolean> {
    const storage = await this.#knowledge.getStorageInternal();
    const binding = await storage.getNodeAddress({ source: this.#importer.source, address: this.#address });
    if (binding?.nodeId !== this.node.id) return false;
    return isExactScope(await storage.getNodeScopeIds(this.node.id), this.#importer.scopeId);
  }
}

class StaticKnowledgeImporterOperationsImpl implements StaticKnowledgeImporterOperations {
  readonly #knowledge: Knowledge;
  readonly #importer: KnowledgeImporterBindingHandle;
  readonly #importRunId: string;
  readonly #assertLeaseOwned?: () => Promise<void>;

  constructor(input: {
    knowledge: Knowledge;
    importer: KnowledgeImporterBindingHandle;
    importRunId: string;
    assertLeaseOwned?: () => Promise<void>;
  }) {
    this.#knowledge = input.knowledge;
    this.#importer = input.importer;
    this.#importRunId = input.importRunId;
    this.#assertLeaseOwned = input.assertLeaseOwned;
  }

  async getNode(address: string): Promise<StaticKnowledgeNodeHandle | null> {
    await this.#assertRunActive();
    const normalized = normalizeAddress(address);
    const storage = await this.#knowledge.getStorageInternal();
    const binding = await storage.getNodeAddress({ source: this.#importer.source, address: normalized });
    if (!binding) return null;
    const node = await this.#knowledge.getNodeInternal(binding.nodeId);
    if (!node || !isExactScope(await storage.getNodeScopeIds(node.id), this.#importer.scopeId)) return null;
    return this.#handle(normalized, node);
  }

  async listNodes(): Promise<StaticKnowledgeNodeHandle[]> {
    await this.#assertRunActive();
    const storage = await this.#knowledge.getStorageInternal();
    const bindings = await storage.listNodeAddresses({ source: this.#importer.source });
    const handles = await Promise.all(
      bindings.map(async binding => {
        const node = await this.#knowledge.getNodeInternal(binding.nodeId);
        if (!node || !isExactScope(await storage.getNodeScopeIds(node.id), this.#importer.scopeId)) return null;
        return this.#handle(binding.address, node);
      }),
    );
    return handles.filter((handle): handle is StaticKnowledgeNodeHandle => handle !== null);
  }

  async upsertNode(address: string, input: StaticKnowledgeNodeInput): Promise<StaticKnowledgeNodeHandle> {
    let expectedAccessEpoch = await this.#assertCapability('append');
    const normalized = normalizeAddress(address);
    const storage = await this.#knowledge.getStorageInternal();
    const binding = await storage.getNodeAddress({ source: this.#importer.source, address: normalized });
    const existing = binding
      ? await this.#knowledge.getNodeInternal(binding.nodeId)
      : await storage.createNodeWithAddress({
          source: this.#importer.source,
          address: normalized,
          node: {
            name: input.name,
            metadata: input.metadata,
            scopeIds: [this.#importer.scopeId],
            contextScopeId: this.#importer.scopeId,
            importRunId: this.#importRunId,
            expectedAccessEpoch,
          },
        });
    if (!existing) throw new Error(`Knowledge node address points to a missing node: ${normalized}`);
    const existingScopeIds = await storage.getNodeScopeIds(existing.id);
    const matchesImporterState =
      existing.name === input.name.trim() &&
      JSON.stringify(existing.metadata) === JSON.stringify(input.metadata) &&
      existingScopeIds.length === 1 &&
      existingScopeIds[0] === this.#importer.scopeId;
    if (matchesImporterState) {
      await this.#setTrackedNode(normalized, existing);
      return this.#handle(normalized, existing);
    }
    if (this.#importer.role === 'append') {
      throw new Error(
        `Knowledge importer ${this.#importer.importerId} cannot update existing nodes with append authority`,
      );
    }
    expectedAccessEpoch = await this.#assertCapability('edit');
    const tracked = await this.#getTrackedNode(normalized);
    if (tracked?.nodeId !== existing.id || tracked.version !== existing.version) {
      throw new Error(`Knowledge node ${normalized} changed outside importer ${this.#importer.importerId}`);
    }
    const updated = await storage.updateNode({
      id: existing.id,
      version: existing.version,
      name: input.name,
      metadata: input.metadata,
      scopeIds: [this.#importer.scopeId],
      contextScopeId: this.#importer.scopeId,
      importRunId: this.#importRunId,
      expectedAccessEpoch,
    });
    await this.#setTrackedNode(normalized, updated);
    return this.#handle(normalized, updated);
  }

  async removeNode(address: string): Promise<{ node: KnowledgeNode; deleted: boolean } | null> {
    await this.#assertRunActive();
    if (this.#importer.role !== 'owner') {
      throw new Error(`Knowledge importer ${this.#importer.importerId} requires owner authority to remove nodes`);
    }
    const expectedAccessEpoch = await this.#assertCapability('delete');
    const storage = await this.#knowledge.getStorageInternal();
    const normalized = normalizeAddress(address);
    const binding = await storage.getNodeAddress({ source: this.#importer.source, address: normalized });
    if (!binding) return null;
    const node = await this.#knowledge.getNodeInternal(binding.nodeId);
    if (!node) return null;
    const tracked = await this.#getTrackedNode(normalized);
    const nodeScopeIds = await storage.getNodeScopeIds(node.id);
    if (
      tracked?.nodeId !== node.id ||
      tracked.version !== node.version ||
      nodeScopeIds.length !== 1 ||
      nodeScopeIds[0] !== this.#importer.scopeId
    ) {
      return { node, deleted: false };
    }
    const result = await storage.deleteNodeByAddress({
      source: this.#importer.source,
      address: normalized,
      scopeId: this.#importer.scopeId,
      importRunId: this.#importRunId,
      expectedAccessEpoch,
    });
    await this.#setTrackedNode(normalized, undefined);
    return result;
  }

  async #getTrackedNode(address: string): Promise<{ nodeId: string; version: number } | undefined> {
    const state = await this.#knowledge.getImportStateInternal({
      importerId: this.#importer.importerId,
      binding: this.#importer.binding,
      key: trackedVersionKey(address),
    });
    if (!state?.value) return undefined;
    try {
      const tracked = JSON.parse(state.value) as { nodeId?: unknown; version?: unknown };
      return typeof tracked.nodeId === 'string' && Number.isSafeInteger(tracked.version) && Number(tracked.version) > 0
        ? { nodeId: tracked.nodeId, version: Number(tracked.version) }
        : undefined;
    } catch {
      return undefined;
    }
  }

  async #setTrackedNode(address: string, node: KnowledgeNode | undefined): Promise<void> {
    await this.#knowledge.setImportStateInternal({
      importerId: this.#importer.importerId,
      binding: this.#importer.binding,
      key: trackedVersionKey(address),
      value: node ? JSON.stringify({ nodeId: node.id, version: node.version }) : '',
    });
  }

  async #assertCapability(capability: KnowledgeCapability): Promise<number> {
    await this.#assertRunActive();
    const frontier = await this.#knowledge.evaluateAccess([this.#importer.principalScopeId]);
    assertKnowledgeTargetCapability({
      frontier,
      scopeIds: [this.#importer.scopeId],
      capability,
      targetType: 'scope',
      targetId: this.#importer.scopeId,
    });
    return frontier.accessEpoch;
  }

  async #assertRunActive(): Promise<void> {
    await this.#assertLeaseOwned?.();
    const run = await this.#knowledge.getImportRunInternal(this.#importRunId);
    if (
      !run ||
      run.importerId !== this.#importer.importerId ||
      run.binding !== this.#importer.binding ||
      (run.importKind !== 'static' && run.importKind !== 'agentic') ||
      run.status !== 'running'
    ) {
      throw new Error(`Knowledge import run ${this.#importRunId} is not active`);
    }
  }

  #handle(address: string, node: KnowledgeNode): StaticKnowledgeNodeHandle {
    return new StaticKnowledgeNodeHandleImpl({
      address,
      node,
      knowledge: this.#knowledge,
      importer: this.#importer,
      importRunId: this.#importRunId,
      assertRunActive: () => this.#assertRunActive(),
    });
  }
}

function trackedVersionKey(address: string): string {
  return `mastra:static-importer:node-version:${address}`;
}

function normalizeAddress(address: string): string {
  const normalized = address.trim();
  if (!normalized) throw new Error('Knowledge importer node address cannot be empty');
  return normalized;
}

function roleRank(role: KnowledgeImporterBindingHandle['role'] | 'readonly'): number {
  return role === 'owner' ? 3 : role === 'edit' ? 2 : role === 'append' ? 1 : 0;
}

function isExactScope(scopeIds: string[], scopeId: string): boolean {
  return scopeIds.length === 1 && scopeIds[0] === scopeId;
}

function matchAddressPattern(pattern: string, address: string): Record<string, string> | null {
  const names: string[] = [];
  const expression = pattern
    .split(/(\$[A-Za-z][A-Za-z0-9_]*)/g)
    .map(part => {
      if (part.startsWith('$')) {
        names.push(part.slice(1));
        return '([^:/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  const match = new RegExp(`^${expression}$`).exec(address);
  if (!match) return null;
  return Object.fromEntries(names.map((name, index) => [name, match[index + 1]!]));
}

function renderAddressPattern(pattern: string, parameters: Record<string, string>): string | null {
  let complete = true;
  const address = pattern.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const value = parameters[name];
    if (!value) complete = false;
    return value ?? '';
  });
  return complete ? address : null;
}
