// src/datasets/dataset.ts
// import { ulid } from 'ulid';
import type { DatasetRow, MastraStorage } from '../storage';

export class Dataset {
  private storage: MastraStorage;
  private datasetId: string;

  constructor(datasetId: string, storage: MastraStorage) {
    this.storage = storage;
    this.datasetId = datasetId;
  }

  async *rows(args?: { versionId?: string }): AsyncGenerator<DatasetRow> {
    let page = 0;
    const perPage = 100;
    let versionToUse = args?.versionId;
    if (!versionToUse) {
      const dataset = await this.storage.getDataset({ id: this.datasetId });
      versionToUse = dataset.currentVersion.id;
    }

    while (true) {
      const { rows, pagination } = await this.storage.getDatasetRows({
        datasetId: this.datasetId,
        versionId: versionToUse,
        pagination: { page, perPage },
      });

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        yield row;
      }

      if (!pagination.hasMore) {
        break;
      }

      page++;
    }
  }
}

// id: string;
// name: string;
// description?: string;
// metadata?: Record<string, any>;
// createdAt: Date;
// updatedAt?: Date;

// // Version operations
// getVersionById: ({id}: {id: string}) => Promise<DatasetVersion>;
// getVersionByVersion: ({version}: {version: string}) => Promise<DatasetVersion>;
// getVersions: ({pagination}: {pagination: PaginationInfo}) => Promise<DatasetVersion[]>;

// // Row operations
// addRows: (rows: DatasetRow[]) => Promise<{ versionId: string }>;

// getRows: ({pagination, versionId}: {pagination: PaginationInfo, versionId?: string}) => Promise<DatasetRow[]>;
// getRowById: ({id, versionId}: {id: string, versionId?: string}) => Promise<DatasetRow>;
// getRowVersionsById: ({ id, pagination }: { id: string, pagination: PaginationInfo }) => Promise<DatasetRow[]>;
// // getRowByTrace: ({traceId, spanId, versionId}: {traceId: string, spanId: string, versionId?: string}) => Promise<DATASET_ROW>;

// rows: ({ versionId }: { versionId: string }) => AsyncIterableIterator<DatasetRow>;

// updateRows: ({ updates }: { updates: UpdateDatasetRow[] }) => Promise<void>;
// deleteRows: ({ rowIds }: { rowIds: DeleteDatasetRow[] }) => Promise<void>;
