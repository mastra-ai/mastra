import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema } from '@mastra/core/storage';

const FILES = 'filesystem_files';

export interface FilesystemFile {
  path: string;
  filename: string;
}

export interface ReplaceFilesystemFilesInput {
  resourceId: string;
  threadId: string;
  files: FilesystemFile[];
}

export const FILESYSTEM_SCHEMAS: CollectionSchema[] = [
  {
    name: FILES,
    columns: {
      id: { type: 'uuid-pk' },
      resource_id: { type: 'text' },
      thread_id: { type: 'text' },
      path: { type: 'text' },
      filename: { type: 'text' },
    },
    uniqueIndexes: [
      {
        name: 'filesystem_files_resource_thread_path_unique',
        columns: ['resource_id', 'thread_id', 'path'],
      },
    ],
  },
];

interface FilesystemFileDbRow extends Record<string, unknown> {
  id: string;
  resource_id: string;
  thread_id: string;
  path: string;
  filename: string;
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
    if (!file.filename.trim()) throw new Error('[FilesystemStorage] filename must not be empty.');
    if (file.filename !== file.path.slice(file.path.lastIndexOf('/') + 1)) {
      throw new Error('[FilesystemStorage] filename must match the leaf of path.');
    }
    if (paths.has(file.path)) throw new Error(`[FilesystemStorage] duplicate file path: ${file.path}`);
    paths.add(file.path);
  }
}

function toFilesystemFile(row: FilesystemFileDbRow): FilesystemFile {
  return { path: row.path, filename: row.filename };
}

export class FilesystemStorage extends FactoryStorageDomain {
  constructor() {
    super('filesystem');
  }

  async init(): Promise<void> {
    await this.ensureCollections(FILESYSTEM_SCHEMAS);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(FILES, {});
  }

  async replaceFiles(input: ReplaceFilesystemFilesInput): Promise<void> {
    assertScope(input);
    validateFiles(input.files);

    await this.storage.withTransaction(async ops => {
      await ops.deleteMany(FILES, { resource_id: input.resourceId, thread_id: input.threadId });
      for (const file of input.files) {
        await ops.insertOne<FilesystemFileDbRow>(FILES, {
          resource_id: input.resourceId,
          thread_id: input.threadId,
          path: file.path,
          filename: file.filename,
        });
      }
    });
  }

  async listFiles(args: { resourceId: string; threadId: string }): Promise<FilesystemFile[]> {
    assertScope(args);
    const files = await this.ops.findMany<FilesystemFileDbRow>(FILES, {
      resource_id: args.resourceId,
      thread_id: args.threadId,
    });
    return files.map(toFilesystemFile).toSorted((a, b) => a.path.localeCompare(b.path));
  }

  async deleteFiles(args: { resourceId: string; threadId: string }): Promise<number> {
    assertScope(args);
    return this.ops.deleteMany(FILES, { resource_id: args.resourceId, thread_id: args.threadId });
  }
}
