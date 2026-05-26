import type {
  AgentInstructionBlock,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageResolvedPromptBlockType,
  StorageListPromptBlocksResolvedOutput,
  StoragePromptBlockSnapshotType,
  PromptBlockVersion,
  PromptBlocksStorage,
} from '@mastra/core/storage';

import { resolveInstructionBlocks } from '../instruction-builder';
import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

const PROMPT_BLOCK_SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'content',
  'rules',
  'requestContextSchema',
] as const satisfies (keyof StoragePromptBlockSnapshotType)[];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    return aKeys.length === bKeys.length && aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

function extractConfigFromVersion(version: PromptBlockVersion): StoragePromptBlockSnapshotType {
  return {
    name: version.name,
    description: version.description,
    content: version.content,
    rules: version.rules,
    requestContextSchema: version.requestContextSchema,
  };
}

function getProvidedConfigFields(input: StorageUpdatePromptBlockInput): Partial<StoragePromptBlockSnapshotType> {
  const config: Partial<StoragePromptBlockSnapshotType> = {};

  for (const field of PROMPT_BLOCK_SNAPSHOT_CONFIG_FIELDS) {
    if (input[field] !== undefined) {
      config[field] = input[field] as never;
    }
  }

  return config;
}

function getProvidedRecordFields(input: StorageUpdatePromptBlockInput): StorageUpdatePromptBlockInput | null {
  const { id, authorId, activeVersionId, metadata, status } = input;
  const recordFields: StorageUpdatePromptBlockInput = { id };

  if (authorId !== undefined) recordFields.authorId = authorId;
  if (activeVersionId !== undefined) recordFields.activeVersionId = activeVersionId;
  if (metadata !== undefined) recordFields.metadata = metadata;
  if (status !== undefined) recordFields.status = status;

  return Object.keys(recordFields).length > 1 ? recordFields : null;
}

function getChangedFields(
  previousConfig: Partial<StoragePromptBlockSnapshotType>,
  providedConfig: Partial<StoragePromptBlockSnapshotType>,
): (keyof StoragePromptBlockSnapshotType)[] {
  return PROMPT_BLOCK_SNAPSHOT_CONFIG_FIELDS.filter(
    field => field in providedConfig && !deepEqual(previousConfig[field], providedConfig[field]),
  );
}

function isVersionNumberConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    (message.includes('unique') && message.includes('constraint')) ||
    message.includes('duplicate key') ||
    message.includes('unique_violation') ||
    message.includes('sqlite_constraint_unique') ||
    (message.includes('version number') && message.includes('already exists')) ||
    message.includes('versionnumber')
  );
}

async function createPromptBlockVersionWithRetry(
  store: PromptBlocksStorage,
  blockId: string,
  providedConfig: Partial<StoragePromptBlockSnapshotType>,
  maxRetries = 3,
): Promise<boolean> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const latestVersion = await store.getLatestVersion(blockId);
      if (!latestVersion) return false;

      const previousConfig = extractConfigFromVersion(latestVersion);
      const changedFields = getChangedFields(previousConfig, providedConfig);
      if (changedFields.length === 0) return false;

      await store.createVersion({
        ...previousConfig,
        ...providedConfig,
        id: crypto.randomUUID(),
        blockId,
        versionNumber: latestVersion.versionNumber + 1,
        changedFields,
        changeMessage: 'Auto-saved after edit',
      });

      return true;
    } catch (error) {
      lastError = error;

      if (isVersionNumberConflictError(error) && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export class EditorPromptNamespace extends CrudEditorNamespace<
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageListPromptBlocksResolvedOutput,
  StorageResolvedPromptBlockType
> {
  protected override onCacheEvict(id: string): void {
    this.mastra?.removePromptBlock(id);
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreatePromptBlockInput,
      StorageUpdatePromptBlockInput,
      StorageListPromptBlocksInput,
      StorageListPromptBlocksOutput,
      StorageListPromptBlocksResolvedOutput,
      StorageResolvedPromptBlockType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('promptBlocks');
    if (!store) throw new Error('Prompt blocks storage domain is not available');

    return {
      create: input => store.create({ promptBlock: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  override async update(input: StorageUpdatePromptBlockInput): Promise<StorageResolvedPromptBlockType> {
    this.ensureRegistered();
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = (await storage.getStore('promptBlocks')) as PromptBlocksStorage | undefined;
    if (!store) throw new Error('Prompt blocks storage domain is not available');

    const existing = await store.getById(input.id);
    if (!existing) {
      throw new Error(`Prompt block with id ${input.id} not found`);
    }

    const providedConfig = getProvidedConfigFields(input);
    if (Object.keys(providedConfig).length > 0) {
      await createPromptBlockVersionWithRetry(store, input.id, providedConfig);
    }

    const recordFields = getProvidedRecordFields(input);
    if (recordFields) {
      await store.update(recordFields);
    }

    this._cache.delete(input.id);
    this.onCacheEvict(input.id);

    const resolved = await store.getByIdResolved(input.id, { status: 'draft' });
    if (!resolved) {
      throw new Error(`Failed to resolve entity ${input.id} after update`);
    }

    this._cache.set(input.id, resolved);
    return resolved;
  }

  async preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string> {
    this.ensureRegistered();
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('promptBlocks');
    if (!store) throw new Error('Prompt blocks storage domain is not available');
    return resolveInstructionBlocks(blocks, context, { promptBlocksStorage: store, includeDrafts: true });
  }
}
