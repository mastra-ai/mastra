import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '../../../evals/types';
import type { TABLE_SCORERS } from '../../constants';
import type { PaginationInfo, StoragePagination, CreateIndexOptions, IndexInfo, StorageIndexStats } from '../../types';

export abstract class EvalsStorageBase extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'EVALS',
    });
  }

  abstract init(): Promise<void>;

  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;

  abstract saveScore(score: ValidatedSaveScorePayload): Promise<{ score: ScoreRowData }>;

  abstract listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  abstract listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }>;

  async listScoresBySpan({
    traceId,
    spanId,
    pagination: _pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { traceId, spanId },
    });
  }

  abstract dropData(): Promise<void>;

  async createIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async dropIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }

  async createIndex<T extends typeof TABLE_SCORERS>({
    name: _name,
    table: _table,
    columns: _columns,
  }: {
    table: T;
  } & Omit<CreateIndexOptions, 'table'>): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async listIndexes<T extends typeof TABLE_SCORERS>(_table: T): Promise<IndexInfo[]> {
    // Optional: subclasses can override this method to implement index listing
    return [];
  }

  async describeIndex(_name: string): Promise<StorageIndexStats> {
    // Optional: subclasses can override this method to implement index description
    throw new Error(
      `Index description is not supported by this storage adapter (${this.constructor.name}). ` +
        `The describeIndex method needs to be implemented in the storage adapter.`,
    );
  }

  async dropIndex(_name: string): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }
}
