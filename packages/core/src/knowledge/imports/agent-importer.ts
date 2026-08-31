import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseKnowledgeImporterBindingKey } from '../../storage/domains/knowledge';
import { createTool } from '../../tools';
import type { Knowledge } from '../index';
import type { StaticKnowledgeImporterOperations } from './static-importer';
import type { KnowledgeAgentImportInput, KnowledgeAgentImportResult, KnowledgeImporterAgentConfig } from './types';

export function knowledgeAgentImportMemoryResourceId(
  knowledge: Knowledge,
  importerId: string,
  binding: string,
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([knowledge.id, importerId, binding]))
    .digest('hex')
    .slice(0, 32);
  return `knowledge-importer:${digest}`;
}

function nodeResult(handle: Awaited<ReturnType<StaticKnowledgeImporterOperations['getNode']>>) {
  if (!handle) return null;
  return { id: handle.id, name: handle.node.name, kind: handle.node.kind, metadata: handle.node.metadata };
}

function createImporterTools(operations: StaticKnowledgeImporterOperations, runId: string) {
  const address = z.string().trim().min(1);
  const metadata = z.record(z.string(), z.unknown()).optional();
  const prefix = `knowledgeImport_${runId.replace(/[^A-Za-z0-9_]/g, '_')}`;
  return {
    [`${prefix}_getNode`]: createTool({
      id: 'knowledge-import-get-node',
      description: 'Read one node owned by this importer binding using its external address.',
      inputSchema: z.object({ address }),
      execute: async ({ address }) => nodeResult(await operations.getNode(address)),
    }),
    [`${prefix}_listNodes`]: createTool({
      id: 'knowledge-import-list-nodes',
      description: 'List nodes still owned by this importer binding.',
      inputSchema: z.object({}),
      execute: async () => Promise.all((await operations.listNodes()).map(handle => nodeResult(handle))),
    }),
    [`${prefix}_upsertNode`]: createTool({
      id: 'knowledge-import-upsert-node',
      description: 'Create or update a node owned by this importer binding using a stable external address.',
      inputSchema: z.object({ address, name: z.string().trim().min(1), metadata }),
      execute: async ({ address, name, metadata }) =>
        nodeResult(await operations.upsertNode(address, { name, ...(metadata ? { metadata } : {}) })),
    }),
    [`${prefix}_removeNode`]: createTool({
      id: 'knowledge-import-remove-node',
      description: 'Permanently remove content still owned exclusively by this importer binding.',
      inputSchema: z.object({ address }),
      execute: async ({ address }) => operations.removeNode(address),
    }),
    [`${prefix}_appendRecord`]: createTool({
      id: 'knowledge-import-append-record',
      description: 'Append a source-owned record to an importer-owned node.',
      inputSchema: z.object({
        address,
        id: z.string().trim().min(1).optional(),
        text: z.string().min(1),
        metadata,
      }),
      execute: async ({ address, id, text, metadata }) => {
        const node = await operations.getNode(address);
        if (!node) throw new Error(`Knowledge importer node address does not exist: ${address}`);
        return node.appendRecord({ ...(id ? { id } : {}), text, ...(metadata ? { metadata } : {}) });
      },
    }),
    [`${prefix}_listRecords`]: createTool({
      id: 'knowledge-import-list-records',
      description: 'List source-owned records on an importer-owned node.',
      inputSchema: z.object({ address }),
      execute: async ({ address }) => {
        const node = await operations.getNode(address);
        return node ? node.listRecords() : [];
      },
    }),
    [`${prefix}_removeRecord`]: createTool({
      id: 'knowledge-import-remove-record',
      description: 'Permanently remove one record still owned exclusively by this importer binding.',
      inputSchema: z.object({ address, id: z.string().trim().min(1) }),
      execute: async ({ address, id }) => {
        const node = await operations.getNode(address);
        if (!node) return null;
        return node.removeRecord(id);
      },
    }),
  };
}

function assertResourceScopedObservationalMemory(config: KnowledgeImporterAgentConfig): void {
  const memory = config.agent.getMemory;
  if (typeof memory !== 'function') {
    throw new Error('Knowledge agentic import requires an Agent with resource-scoped observational memory');
  }
}

/** @internal Runs one registered Agent against binding-owned importer tools. */
export async function runAgenticKnowledgeImport(input: {
  knowledge: Knowledge;
  importerId: string;
  binding: string;
  runId: string;
  signal: AbortSignal;
  config: KnowledgeImporterAgentConfig;
  operations: StaticKnowledgeImporterOperations;
  request: KnowledgeAgentImportInput;
}): Promise<KnowledgeAgentImportResult> {
  assertResourceScopedObservationalMemory(input.config);
  const memory = await input.config.agent.getMemory();
  const memoryConfig = memory?.getMergedThreadConfig();
  const observationalMemory = memoryConfig?.observationalMemory;
  if (
    !observationalMemory ||
    observationalMemory === true ||
    observationalMemory.enabled === false ||
    observationalMemory.scope !== 'resource'
  ) {
    throw new Error('Knowledge agentic import requires resource-scoped observational memory');
  }

  const instructions = input.request.instructions.trim();
  const checkpoint = input.request.checkpoint.trim();
  if (!instructions) throw new Error('Knowledge agentic import instructions are required');
  if (!checkpoint) throw new Error('Knowledge agentic import checkpoint is required');
  const serializedData = JSON.stringify(input.request.data);
  if (serializedData === undefined) throw new Error('Knowledge agentic import data must be JSON-serializable');

  const resourceId = knowledgeAgentImportMemoryResourceId(input.knowledge, input.importerId, input.binding);
  const threadId = `knowledge-import-run:${input.runId}`;
  const encodedCheckpoint = encodeURIComponent(checkpoint);
  const destination = await (
    await input.knowledge.getStorageInternal()
  ).getScopeAddress(parseKnowledgeImporterBindingKey(input.binding).scope);
  const destinationDescription = destination
    ? (await input.knowledge.getNodeInternal(destination.scopeNodeId))?.metadata?.description
    : undefined;
  const prompt = [
    'You are integrating external evidence into a canonical Knowledge graph.',
    `Knowledge instance: ${input.knowledge.description ?? input.knowledge.id}`,
    ...(typeof destinationDescription === 'string' ? [`Destination scope: ${destinationDescription}`] : []),
    'Use only the supplied knowledge-import tools. Preserve stable external addresses. Integrate with existing source-owned nodes instead of blindly appending duplicates. Never invent evidence, provenance, identifiers, or deletions.',
    `Task instructions: ${instructions}`,
    `Raw JSON data:\n${serializedData}`,
    `When all durable tool calls are complete, finish with exactly <import-complete checkpoint="${encodedCheckpoint}" />. Do not emit this marker before the work is complete.`,
  ].join('\n\n');

  const tools = createImporterTools(input.operations, input.runId);
  const activeTools = Object.keys(tools);
  const result = await input.config.agent.generate(prompt, {
    memory: { resource: resourceId, thread: threadId },
    toolsets: { knowledgeImport: tools },
    prepareStep: () => ({ activeTools }),
    maxSteps: input.config.maxSteps ?? 20,
    abortSignal: input.signal,
  });
  const marker = `<import-complete checkpoint="${encodedCheckpoint}" />`;
  if (!result.text.trimEnd().endsWith(marker)) {
    throw new Error(`Knowledge agentic import did not acknowledge checkpoint ${checkpoint}`);
  }
  return { checkpoint, resourceId, transcriptThreadId: threadId, text: result.text };
}
