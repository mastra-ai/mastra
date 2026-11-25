import type {
  KnowledgeImporterBindingRecord,
  KnowledgeImporterFlushRecord,
  KnowledgeImporterNodeRecord,
  KnowledgeImporterPage,
  KnowledgeImporterRunChangeRecord,
  KnowledgeImporterRunRecord,
  KnowledgeImporterRunStartResult,
  KnowledgeImporterRunStatus,
  KnowledgeImporterWriterGuard,
} from './importers';
import {
  KnowledgeImporterBindingConflictError,
  KnowledgeImporterRunStateError,
  KnowledgeImportersStorage,
} from './importers';

interface State {
  bindings: Map<string, KnowledgeImporterBindingRecord>;
  nodes: Map<string, KnowledgeImporterNodeRecord>;
  state: Map<string, Map<string, string>>;
  runs: Map<string, KnowledgeImporterRunRecord>;
  flushes: Map<string, KnowledgeImporterFlushRecord>;
  changes: Map<string, { order: number; change: KnowledgeImporterRunChangeRecord }>;
  guard: KnowledgeImporterWriterGuard;
  order: number;
}

const empty = (): State => ({
  bindings: new Map(),
  nodes: new Map(),
  state: new Map(),
  runs: new Map(),
  flushes: new Map(),
  changes: new Map(),
  guard: { activePath: 'new', generation: 1, firstWriteAt: null },
  order: 0,
});

const key = (...parts: (string | number)[]) => JSON.stringify(parts);
/**
 * UTF-8 byte order, the order PostgreSQL's `COLLATE "C"` and SQLite's BINARY give. Code point order
 * is the same thing; JavaScript's `<` compares UTF-16 code units, which puts characters above U+FFFF
 * (surrogate pairs) before U+E000–U+FFFF.
 */
const byteOrder = (a: string, b: string) => {
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    const x = a.codePointAt(i)!;
    const y = b.codePointAt(j)!;
    if (x !== y) return x < y ? -1 : 1;
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
};

function addCounts(into: Record<string, number>, add: Record<string, number>): Record<string, number> {
  const out = { ...into };
  for (const [name, value] of Object.entries(add)) out[name] = (out[name] ?? 0) + value;
  return out;
}

/**
 * In-memory importer bookkeeping. One process, no locks: the owning store runs transactions one at
 * a time and rolls them back by restoring {@link snapshot}.
 */
export class InMemoryKnowledgeImportersStorage extends KnowledgeImportersStorage {
  #s = empty();

  snapshot(): State {
    return structuredClone(this.#s);
  }
  restore(state: State): void {
    this.#s = state;
  }

  async init(): Promise<void> {}
  async dangerouslyClearAll(): Promise<void> {
    this.#s = empty();
  }

  /** Part of the Knowledge store's reset: empties everything and moves the generation forward. */
  clearOnReset(): void {
    const { activePath, generation } = this.#s.guard;
    this.#s = empty();
    this.#s.guard = { activePath, generation: generation + 1, firstWriteAt: null };
  }

  async registerBinding(input: { id: string; importer: string; target: string }) {
    const existing = this.#s.bindings.get(input.id);
    if (existing) {
      if (existing.importer !== input.importer || existing.target !== input.target) {
        throw new KnowledgeImporterBindingConflictError(input.id);
      }
      return { status: 'unchanged' as const, binding: { ...existing } };
    }
    const binding = { ...input, anchorPageId: null, createdAt: new Date() };
    this.#s.bindings.set(input.id, binding);
    return { status: 'created' as const, binding: { ...binding } };
  }
  async getBinding(id: string) {
    const binding = this.#s.bindings.get(id);
    return binding ? { ...binding } : null;
  }
  async setBindingAnchor(input: { bindingId: string; expected: string | null; pageId: string | null }) {
    const binding = this.#s.bindings.get(input.bindingId);
    if (!binding || binding.anchorPageId !== input.expected) return false;
    binding.anchorPageId = input.pageId;
    return true;
  }
  async listBindings() {
    return [...this.#s.bindings.values()].sort((a, b) => byteOrder(a.id, b.id)).map(b => ({ ...b }));
  }
  async retireBinding(id: string) {
    this.#s.bindings.delete(id);
    for (const [k, node] of this.#s.nodes) if (node.bindingId === id) this.#s.nodes.delete(k);
    this.#s.state.delete(id);
    const runs = new Set<string>();
    for (const [runId, run] of this.#s.runs) {
      if (run.bindingId !== id) continue;
      runs.add(runId);
      this.#s.runs.delete(runId);
    }
    for (const [k, flush] of this.#s.flushes) if (runs.has(flush.runId)) this.#s.flushes.delete(k);
    for (const [k, { change }] of this.#s.changes) if (runs.has(change.runId)) this.#s.changes.delete(k);
  }

  async startRun(input: {
    bindingId: string;
    runId: string;
    generation: number;
    fireKey?: string;
    deadlineAt?: Date;
  }): Promise<KnowledgeImporterRunStartResult> {
    const runs = [...this.#s.runs.values()].filter(r => r.bindingId === input.bindingId);
    if (input.fireKey) {
      const fired = runs.find(r => r.fireKey === input.fireKey);
      if (fired) return { status: 'duplicate', run: structuredClone(fired) };
    }
    const running = runs.some(r => r.status === 'running');
    const now = new Date();
    const run: KnowledgeImporterRunRecord = {
      id: input.runId,
      bindingId: input.bindingId,
      generation: input.generation,
      status: running ? 'skipped' : 'running',
      fireKey: input.fireKey ?? null,
      deadlineAt: input.deadlineAt ?? null,
      cancelRequestedAt: null,
      heartbeatAt: null,
      lastSeq: 0,
      finish: null,
      counts: {},
      startedAt: now,
      completedAt: running ? now : null,
    };
    this.#s.runs.set(run.id, run);
    return { status: running ? 'skipped' : 'started', run: structuredClone(run) };
  }
  async getRun(runId: string) {
    const run = this.#s.runs.get(runId);
    return run ? structuredClone(run) : null;
  }
  async listRuns(bindingId: string, options: { limit?: number } = {}) {
    return [...this.#s.runs.values()]
      .filter(r => r.bindingId === bindingId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, options.limit ?? 50)
      .map(r => structuredClone(r));
  }
  async requestCancel(runId: string) {
    const run = this.#s.runs.get(runId);
    if (!run || run.status !== 'running') return null;
    run.cancelRequestedAt ??= new Date();
    return structuredClone(run);
  }
  async heartbeat(runId: string) {
    const run = this.#s.runs.get(runId);
    if (!run || run.status !== 'running') return null;
    run.heartbeatAt = new Date();
    return structuredClone(run);
  }
  async abandonRun(input: { runId: string; finish: unknown; status?: 'failed' | 'canceled' }) {
    const run = this.#s.runs.get(input.runId);
    if (!run || run.status !== 'running') return null;
    run.status = input.status ?? 'failed';
    run.finish = structuredClone(input.finish);
    run.completedAt = new Date();
    return structuredClone(run);
  }
  /** Transactions run one at a time in memory, so a read is as good as a lock. */
  async lockRun(runId: string) {
    return this.getRun(runId);
  }

  #activeRun(runId: string, generation: number): KnowledgeImporterRunRecord {
    const run = this.#s.runs.get(runId);
    if (!run) throw new KnowledgeImporterRunStateError(runId, 'not_found');
    if (run.status !== 'running') throw new KnowledgeImporterRunStateError(runId, 'not_running');
    if (run.generation !== generation) throw new KnowledgeImporterRunStateError(runId, 'generation');
    if (this.#s.guard.generation !== generation) throw new KnowledgeImporterRunStateError(runId, 'stale_guard');
    return run;
  }

  async getFlush(runId: string, generation: number, seq: number) {
    const flush = this.#s.flushes.get(key(runId, generation, seq));
    return flush ? structuredClone(flush) : null;
  }
  async recordFlush(input: KnowledgeImporterFlushRecord & { counts: Record<string, number> }) {
    const run = this.#activeRun(input.runId, input.generation);
    if (run.lastSeq !== input.seq - 1) throw new KnowledgeImporterRunStateError(input.runId, 'seq');
    const { counts, ...flush } = input;
    this.#s.flushes.set(key(input.runId, input.generation, input.seq), structuredClone(flush));
    run.lastSeq = input.seq;
    run.counts = addCounts(run.counts, counts);
  }
  async finishRun(input: {
    runId: string;
    generation: number;
    lastSeq: number;
    status: Exclude<KnowledgeImporterRunStatus, 'running' | 'skipped'>;
    finish: unknown;
  }) {
    const run = this.#activeRun(input.runId, input.generation);
    if (run.lastSeq !== input.lastSeq) throw new KnowledgeImporterRunStateError(input.runId, 'seq');
    run.status = input.status;
    run.finish = structuredClone(input.finish);
    run.completedAt = new Date();
    return structuredClone(run);
  }

  async getNode(bindingId: string, sourceId: string) {
    const node = this.#s.nodes.get(key(bindingId, sourceId));
    return node ? structuredClone(node) : null;
  }
  async getNodeByPage(pageId: string) {
    const node = [...this.#s.nodes.values()].find(n => n.pageId === pageId);
    return node ? structuredClone(node) : null;
  }
  async saveNode(node: Omit<KnowledgeImporterNodeRecord, 'updatedAt'>) {
    const owner = [...this.#s.nodes.values()].find(n => n.pageId === node.pageId);
    if (owner && (owner.bindingId !== node.bindingId || owner.sourceId !== node.sourceId)) {
      throw new Error(`Knowledge page ${node.pageId} is already mapped to another imported node`);
    }
    this.#s.nodes.set(key(node.bindingId, node.sourceId), structuredClone({ ...node, updatedAt: new Date() }));
  }
  async deleteNode(bindingId: string, sourceId: string) {
    this.#s.nodes.delete(key(bindingId, sourceId));
  }
  async listNodes(
    bindingId: string,
    options: { after?: string; limit?: number; unsettled?: boolean } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterNodeRecord>> {
    const limit = options.limit ?? 500;
    const nodes = [...this.#s.nodes.values()]
      .filter(
        n =>
          n.bindingId === bindingId &&
          (options.after === undefined || byteOrder(n.sourceId, options.after) > 0) &&
          (!options.unsettled || n.unsettled),
      )
      .sort((a, b) => byteOrder(a.sourceId, b.sourceId));
    const items = nodes.slice(0, limit).map(n => structuredClone(n));
    return { items, next: nodes.length > limit ? items[items.length - 1]!.sourceId : null };
  }
  #linking(bindingId: string, targetSourceIds: string[]) {
    const targets = new Set(targetSourceIds);
    return [...this.#s.nodes.values()].filter(
      n => n.bindingId === bindingId && n.links.some(link => targets.has(link.sourceId)),
    );
  }
  async listLinkingNodes(
    bindingId: string,
    targetSourceIds: string[],
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<string>> {
    const limit = options.limit ?? 500;
    const ids = this.#linking(bindingId, targetSourceIds)
      .map(n => n.sourceId)
      .filter(id => options.after === undefined || byteOrder(id, options.after) > 0)
      .sort(byteOrder);
    const items = ids.slice(0, limit);
    return { items, next: ids.length > limit ? items[items.length - 1]! : null };
  }
  async markLinkingNodesUnsettled(bindingId: string, targetSourceIds: string[]) {
    for (const n of this.#linking(bindingId, targetSourceIds)) n.unsettled = true;
  }
  async findNodeByAlias(bindingId: string, alias: string) {
    const node = [...this.#s.nodes.values()].find(n => n.bindingId === bindingId && n.aliases.includes(alias));
    return node ? structuredClone(node) : null;
  }

  async getState(bindingId: string) {
    const out: Record<string, string> = {};
    for (const [name, value] of this.#s.state.get(bindingId) ?? []) {
      Object.defineProperty(out, name, { value, enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  async setState(bindingId: string, state: Record<string, string>) {
    const stored = this.#s.state.get(bindingId) ?? new Map<string, string>();
    for (const name of Object.keys(state)) stored.set(name, state[name]!);
    this.#s.state.set(bindingId, stored);
  }

  async recordRunChange(change: KnowledgeImporterRunChangeRecord) {
    const id = key(change.runId, change.sourceId);
    const order = this.#s.changes.get(id)?.order ?? ++this.#s.order;
    this.#s.changes.set(id, { order, change: structuredClone(change) });
  }
  async listRunChanges(
    runId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterRunChangeRecord>> {
    const limit = options.limit ?? 500;
    const after = options.after === undefined ? 0 : Number(options.after);
    const rows = [...this.#s.changes.values()]
      .filter(c => c.change.runId === runId && c.order > after)
      .sort((a, b) => a.order - b.order);
    const page = rows.slice(0, limit);
    return {
      items: page.map(c => structuredClone(c.change)),
      next: rows.length > limit ? String(page[page.length - 1]!.order) : null,
    };
  }

  async readWriterGuard() {
    return { ...this.#s.guard };
  }
  async lockWriterGuard(_mode: 'share' | 'update') {
    return { ...this.#s.guard };
  }
  /** Transactions are serialized here, so holding one is the lock. */
  async markFirstWrite() {
    if (this.#s.guard.firstWriteAt) return false;
    this.#s.guard.firstWriteAt = new Date();
    return true;
  }
  async advanceWriterGuard(input: { activePath: string; generation: number }) {
    if (input.generation <= this.#s.guard.generation) {
      throw new Error(
        `Knowledge importer writer generation must move forward (${this.#s.guard.generation} -> ${input.generation})`,
      );
    }
    this.#s.guard = { activePath: input.activePath, generation: input.generation, firstWriteAt: null };
    return { ...this.#s.guard };
  }
}
