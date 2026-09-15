import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema } from '@mastra/core/storage';

const SNAPSHOTS = 'filesystem_snapshots';

export interface FilesystemFile {
  path: string;
}

export interface ReplaceFilesystemFilesInput {
  resourceId: string;
  threadId: string;
  files: FilesystemFile[];
}

export const FILESYSTEM_SCHEMAS: CollectionSchema[] = [
  {
    name: SNAPSHOTS,
    columns: {
      id: { type: 'uuid-pk' },
      resource_id: { type: 'text' },
      thread_id: { type: 'text' },
      files: { type: 'json' },
      captured_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'filesystem_snapshots_resource_thread_unique',
        columns: ['resource_id', 'thread_id'],
      },
    ],
  },
];

interface FilesystemSnapshotDbRow extends Record<string, unknown> {
  id: string;
  resource_id: string;
  thread_id: string;
  files: FilesystemFile[];
  captured_at: Date;
}

function assertIdentifier(value: string, label: string): void {
  if (!value.trim()) throw new Error(`[FilesystemStorage] ${label} must not be empty.`);
}

function assertRelativePath(value: string): void {
  if (
    !value ||
    value.startsWith('/') ||
    value.split('/').some(segment => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('[FilesystemStorage] path must be a non-empty relative path.');
  }
}

function assertScope(args: { resourceId: string; threadId: string }): void {
  assertIdentifier(args.resourceId, 'resourceId');
  assertIdentifier(args.threadId, 'threadId');
}

function validateFiles(files: FilesystemFile[]): void {
  const paths = new Set<string>();

  for (const file of files) {
    assertRelativePath(file.path);
    if (paths.has(file.path)) throw new Error(`[FilesystemStorage] duplicate file path: ${file.path}`);
    paths.add(file.path);
  }
}

export class FilesystemStorage extends FactoryStorageDomain {
  constructor() {
    super('filesystem');
  }

  async init(): Promise<void> {
    await this.ensureCollections(FILESYSTEM_SCHEMAS);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(SNAPSHOTS, {});
  }

  async replaceFiles(input: ReplaceFilesystemFilesInput): Promise<void> {
    assertScope(input);
    validateFiles(input.files);

    await this.ops.upsertOne<FilesystemSnapshotDbRow>(SNAPSHOTS, ['resource_id', 'thread_id'], {
      resource_id: input.resourceId,
      thread_id: input.threadId,
      files: input.files.toSorted((a, b) => a.path.localeCompare(b.path)),
      captured_at: new Date(),
    });
  }

  async listFiles(args: { resourceId: string; threadId: string }): Promise<FilesystemFile[]> {
    assertScope(args);
    const snapshot = await this.ops.findOne<FilesystemSnapshotDbRow>(SNAPSHOTS, {
      resource_id: args.resourceId,
      thread_id: args.threadId,
    });
    return snapshot?.files ?? [];
  }

  async deleteFiles(args: { resourceId: string; threadId: string }): Promise<number> {
    assertScope(args);
    return this.ops.deleteMany(SNAPSHOTS, { resource_id: args.resourceId, thread_id: args.threadId });
  }
}
