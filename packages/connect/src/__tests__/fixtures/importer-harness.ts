import type {
  KnowledgeImporterDefinition,
  KnowledgeImporterHandlerContext,
  KnowledgeImporterState,
  StaticKnowledgeImporterOperations,
  StaticKnowledgeNodeHandle,
  StaticKnowledgeNodeInput,
  StaticKnowledgeRecordInput,
} from '@mastra/core/knowledge';

/**
 * In-memory fake of the static-importer operations. Only the shape importer
 * handlers actually consume is emulated — nodes are keyed by address, records
 * live under nodes, and node/record raw objects are stubbed as `never` casts
 * because handlers never inspect them.
 */
export interface FakeRecord {
  id: string;
  text: string;
  metadata?: unknown;
}
export interface FakeNode {
  address: string;
  input: StaticKnowledgeNodeInput;
  records: Map<string, FakeRecord>;
}

export interface FakeImporter extends StaticKnowledgeImporterOperations {
  readonly nodes: Map<string, FakeNode>;
  role: 'owner' | 'edit';
}

export function createFakeImporter(role: 'owner' | 'edit' = 'owner'): FakeImporter {
  const nodes = new Map<string, FakeNode>();
  const makeHandle = (node: FakeNode): StaticKnowledgeNodeHandle => ({
    node: {} as never,
    id: node.address,
    async appendRecord(input: StaticKnowledgeRecordInput) {
      const id = input.id ?? `auto-${node.records.size}`;
      node.records.set(id, { id, text: input.text, metadata: input.metadata });
      return { id, text: input.text } as never;
    },
    async listRecords() {
      return [...node.records.values()].map(r => ({ id: r.id, text: r.text, metadata: r.metadata }) as never);
    },
    async removeRecord(id: string) {
      const record = node.records.get(id);
      if (!record) return null;
      node.records.delete(id);
      return record as never;
    },
  });
  const importer: FakeImporter = {
    nodes,
    role,
    async getNode(address) {
      const n = nodes.get(address);
      return n ? makeHandle(n) : null;
    },
    async listNodes() {
      return [...nodes.values()].map(makeHandle);
    },
    async upsertNode(address, input) {
      let node = nodes.get(address);
      if (!node) {
        node = { address, input, records: new Map() };
        nodes.set(address, node);
      } else {
        node.input = input;
      }
      return makeHandle(node);
    },
    async removeNode(address) {
      const node = nodes.get(address);
      if (!node) return null;
      if (importer.role !== 'owner') return null;
      nodes.delete(address);
      return { node: {} as never, deleted: true };
    },
  };
  return importer;
}

export function createFakeState(initial: Record<string, string> = {}): KnowledgeImporterState & {
  readonly entries: Map<string, string>;
} {
  const entries = new Map<string, string>(Object.entries(initial));
  return {
    entries,
    async get(key) {
      return entries.get(key);
    },
    async set(key, value) {
      entries.set(key, value);
    },
  };
}

export interface RunImporterOptions {
  payload?: unknown;
  signal?: AbortSignal;
}

/**
 * Invokes a definition's handler against fake importer operations and durable
 * state. Returns both so tests can assert on the imported graph and the
 * committed watermark independently.
 */
export async function runImporter(
  definition: KnowledgeImporterDefinition,
  fixtures: { importer: FakeImporter; state: ReturnType<typeof createFakeState> },
  options: RunImporterOptions = {},
): Promise<void> {
  const signal = options.signal ?? new AbortController().signal;
  const ctx: KnowledgeImporterHandlerContext = {
    knowledge: {} as never,
    payload: options.payload,
    run: {} as never,
    signal,
    state: fixtures.state,
    importer: async () => fixtures.importer,
  };
  await definition.handler(ctx);
}
