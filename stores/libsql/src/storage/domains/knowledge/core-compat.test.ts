import * as knowledgeCompat from '@internal/core/knowledge-compat';
import * as coreStorage from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

// Every value adapters bundle from knowledge-compat instead of importing from @mastra/core.
const COMPAT_VALUES = [
  'KNOWLEDGE_STORAGE_CONTRACT_VERSION',
  'KNOWLEDGE_STORAGE_SCHEMA_VERSION',
  'KNOWLEDGE_TABLE_NAMES',
  'TABLE_KNOWLEDGE_ACCESS_STATE',
  'TABLE_KNOWLEDGE_IMPORT_RUNS',
  'TABLE_KNOWLEDGE_IMPORT_STATE',
  'TABLE_KNOWLEDGE_NODE_ADDRESSES',
  'TABLE_KNOWLEDGE_NODE_SCOPES',
  'TABLE_KNOWLEDGE_PROPOSALS',
  'TABLE_KNOWLEDGE_RECORD_SCOPES',
  'TABLE_KNOWLEDGE_SCHEMA',
  'TABLE_KNOWLEDGE_SCOPE_ADDRESSES',
  'TABLE_KNOWLEDGE_SCOPE_GRANTS',
  'KNOWLEDGE_ACCESS_STATE_SCHEMA',
  'KNOWLEDGE_IMPORT_RUNS_SCHEMA',
  'KNOWLEDGE_IMPORT_STATE_SCHEMA',
  'KNOWLEDGE_NODE_ADDRESSES_SCHEMA',
  'KNOWLEDGE_NODE_SCOPES_SCHEMA',
  'KNOWLEDGE_PROPOSALS_SCHEMA',
  'KNOWLEDGE_RECORD_SCOPES_SCHEMA',
  'KNOWLEDGE_SCHEMA_SCHEMA',
  'KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA',
  'KNOWLEDGE_SCOPE_GRANTS_SCHEMA',
] as const;

const SCOPE_A = '0190a6a0-0000-7000-8000-00000000000a';
const SCOPE_B = '0190a6a0-0000-7000-8000-00000000000b';
const NODE = '0190a6a0-0000-7000-8000-0000000000ff';

describe('Knowledge core compatibility', () => {
  it('keeps bundled values equal to current core', () => {
    for (const name of COMPAT_VALUES) {
      expect(knowledgeCompat[name], name).toEqual(coreStorage[name]);
    }
  });

  it('keeps bundled helpers behaviorally equal to current core', () => {
    for (const id of [` ${SCOPE_A.toUpperCase()} `, SCOPE_B]) {
      expect(knowledgeCompat.canonicalizeKnowledgeNodeId(id)).toBe(coreStorage.canonicalizeKnowledgeNodeId(id));
    }
    expect(() => knowledgeCompat.canonicalizeKnowledgeNodeId('scope-a')).toThrow(
      new Error('Knowledge node IDs must be UUIDs.'),
    );
    expect(() => coreStorage.canonicalizeKnowledgeNodeId('scope-a')).toThrow(
      new Error('Knowledge node IDs must be UUIDs.'),
    );

    const scopeIds = [SCOPE_B, SCOPE_A.toUpperCase(), SCOPE_B];
    expect(knowledgeCompat.canonicalizeKnowledgeScopeIds(scopeIds)).toEqual(
      coreStorage.canonicalizeKnowledgeScopeIds(scopeIds),
    );
    expect(knowledgeCompat.knowledgeScopeIdsKey(scopeIds)).toBe(coreStorage.knowledgeScopeIdsKey(scopeIds));
    expect(knowledgeCompat.canonicalizeKnowledgeRecordScopeIds(scopeIds)).toEqual(
      coreStorage.canonicalizeKnowledgeRecordScopeIds(scopeIds),
    );
    for (const storage of [knowledgeCompat, coreStorage]) {
      expect(() => storage.canonicalizeKnowledgeRecordScopeIds([])).toThrow(
        new Error('Knowledge records require at least one scope.'),
      );
    }

    for (const binding of ['[" github ","repo:mastra "]', '["github","repo:mastra"]']) {
      expect(knowledgeCompat.canonicalizeKnowledgeImporterBindingKey(binding)).toBe(
        coreStorage.canonicalizeKnowledgeImporterBindingKey(binding),
      );
    }
    for (const binding of ['["github"]', '["github",""]', '[1,"repo"]', 'not json']) {
      const message = 'Knowledge importer binding must encode a [source, scope] tuple';
      expect(() => knowledgeCompat.canonicalizeKnowledgeImporterBindingKey(binding)).toThrow(new Error(message));
      expect(() => coreStorage.canonicalizeKnowledgeImporterBindingKey(binding)).toThrow(new Error(message));
    }

    const cases: [{ id: string; isScope: boolean }, string[], string[]][] = [
      [{ id: SCOPE_A, isScope: true }, [], [SCOPE_A]],
      [{ id: SCOPE_A, isScope: false }, [], [SCOPE_A]],
      [{ id: NODE, isScope: false }, [SCOPE_B], [SCOPE_A, SCOPE_B]],
      [{ id: NODE, isScope: false }, [SCOPE_B], [SCOPE_A]],
      [{ id: NODE, isScope: true }, [], []],
    ];
    for (const [node, nodeScopeIds, visibleScopeIds] of cases) {
      expect(knowledgeCompat.isKnowledgeNodeVisible(node, nodeScopeIds, visibleScopeIds)).toBe(
        coreStorage.isKnowledgeNodeVisible(node, nodeScopeIds, visibleScopeIds),
      );
    }
  });

  it('loads core runtime values from a core advertising the matching contract', async () => {
    const loadCore = knowledgeCompat.createKnowledgeCoreLoader(new Set(['knowledge-v2']), () =>
      Promise.resolve(coreStorage),
    );
    const core = await loadCore();

    expect(core.KnowledgeSchemaError).toBe(coreStorage.KnowledgeSchemaError);
    expect(core.KnowledgeUnsupportedError).toBe(coreStorage.KnowledgeUnsupportedError);
    expect(core.sanitizeKnowledgeImportError).toBe(coreStorage.sanitizeKnowledgeImportError);
  });

  it('rejects a core without the Knowledge feature before loading its storage module', async () => {
    const loadStorageModule = vi.fn();
    const loadCore = knowledgeCompat.createKnowledgeCoreLoader(new Set(), loadStorageModule);

    await expect(loadCore()).rejects.toThrow(
      'Knowledge requires an @mastra/core release with the "knowledge-v2" feature',
    );
    expect(loadStorageModule).not.toHaveBeenCalled();
  });

  it('rejects a core with a different Knowledge storage contract', async () => {
    const loadCore = knowledgeCompat.createKnowledgeCoreLoader(new Set(['knowledge-v2']), async () => ({
      ...coreStorage,
      KNOWLEDGE_STORAGE_CONTRACT_VERSION: 2,
    }));

    await expect(loadCore()).rejects.toThrow(
      "Knowledge storage contract 2 in @mastra/core does not match the adapter's contract 1",
    );
  });

  it('coalesces successful loads and retries a failed load', async () => {
    const loadStorageModule = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(coreStorage);
    const loadCore = knowledgeCompat.createKnowledgeCoreLoader(new Set(['knowledge-v2']), loadStorageModule);

    await expect(loadCore()).rejects.toThrow('temporary failure');
    const [first, second] = await Promise.all([loadCore(), loadCore()]);

    expect(first).toBe(second);
    expect(loadStorageModule).toHaveBeenCalledTimes(2);
  });
});
