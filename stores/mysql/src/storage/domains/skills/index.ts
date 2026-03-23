import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  SkillsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
  SKILLS_SCHEMA,
  SKILL_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
} from '@mastra/core/storage';
import type {
  SkillVersion,
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
} from '@mastra/core/storage/domains/skills';

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

const SNAPSHOT_FIELDS = [
  'name', 'description', 'instructions', 'license', 'compatibility',
  'source', 'references', 'scripts', 'assets', 'metadata', 'tree',
] as const;

export class SkillsMySQL extends SkillsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SKILLS, schema: SKILLS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_SKILL_VERSIONS, schema: SKILL_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SKILL_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_SKILLS });
  }

  private safeParseJSON(val: unknown): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseSkillRow(row: Record<string, unknown>): StorageSkillType {
    return {
      id: row.id as string,
      status: (row.status as StorageSkillType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): SkillVersion {
    return {
      id: row.id as string,
      skillId: row.skillId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      instructions: (row.instructions as string) ?? undefined,
      license: (row.license as string) ?? undefined,
      compatibility: this.safeParseJSON(row.compatibility) as SkillVersion['compatibility'],
      source: this.safeParseJSON(row.source) as SkillVersion['source'],
      references: this.safeParseJSON(row.references) as SkillVersion['references'],
      scripts: this.safeParseJSON(row.scripts) as SkillVersion['scripts'],
      assets: this.safeParseJSON(row.assets) as SkillVersion['assets'],
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      tree: this.safeParseJSON(row.tree) as SkillVersion['tree'],
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StorageSkillType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_SKILLS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseSkillRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SKILL', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_SKILLS,
        record: { id: skill.id, status: 'draft', activeVersionId: null, authorId: skill.authorId ?? null, createdAt: now, updatedAt: now },
      });

      const { id: _id, authorId: _authorId, ...snapshotConfig } = skill;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({ id: versionId, skillId: skill.id, versionNumber: 1, ...snapshotConfig, changedFields: Object.keys(snapshotConfig), changeMessage: 'Initial version' });
      } catch (versionError) {
        await this.operations.delete({ tableName: TABLE_SKILLS, keys: { id: skill.id } });
        throw versionError;
      }

      return { id: skill.id, status: 'draft', activeVersionId: undefined, authorId: skill.authorId, createdAt: now, updatedAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_SKILL', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SKILL', 'NOT_FOUND'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `Skill ${id} not found`, details: { skillId: id } });

      const { authorId, activeVersionId, status, ...configFields } = updates;
      const configFieldNames = SNAPSHOT_FIELDS as readonly string[];
      const hasConfigUpdate = configFieldNames.some(field => field in configFields);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) { updateData.activeVersionId = activeVersionId; if (status === undefined) updateData.status = 'published'; }
      if (status !== undefined) updateData.status = status;

      await this.operations.update({ tableName: TABLE_SKILLS, keys: { id }, data: updateData });

      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SKILL', 'NO_VERSIONS'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `No versions found for skill ${id}`, details: { skillId: id } });

        const { id: _versionId, skillId: _skillId, versionNumber: _versionNumber, changedFields: _changedFields, changeMessage: _changeMessage, createdAt: _createdAt, ...latestConfig } = latestVersion;
        const newConfig = { ...latestConfig, ...configFields };
        const changedFields = configFieldNames.filter(
          field => field in configFields && JSON.stringify(configFields[field as keyof typeof configFields]) !== JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          const newVersionId = crypto.randomUUID();
          await this.createVersion({ id: newVersionId, skillId: id, versionNumber: latestVersion.versionNumber + 1, ...newConfig, changedFields, changeMessage: `Updated ${changedFields.join(', ')}` });
        }
      }

      const updated = await this.getById(id);
      if (!updated) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SKILL', 'NOT_FOUND_AFTER_UPDATE'), domain: ErrorDomain.STORAGE, category: ErrorCategory.SYSTEM, text: `Skill ${id} not found after update`, details: { id } });
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SKILL', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_SKILLS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SKILL', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];
      if (authorId !== undefined) { conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`); queryParams.push(authorId); }

      const whereClause = conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams } : undefined;
      const total = await this.operations.loadTotalCount({ tableName: TABLE_SKILLS, whereClause });
      if (total === 0) return { skills: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SKILLS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { skills: rows.map(row => this.parseSkillRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_SKILLS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_SKILL_VERSIONS,
        record: {
          id: input.id, skillId: input.skillId, versionNumber: input.versionNumber,
          name: input.name, description: input.description ?? null,
          instructions: input.instructions ?? null, license: input.license ?? null,
          compatibility: input.compatibility ?? null, source: input.source ?? null,
          references: input.references ?? null, scripts: input.scripts ?? null,
          assets: input.assets ?? null, metadata: input.metadata ?? null, tree: input.tree ?? null,
          changedFields: input.changedFields ?? null, changeMessage: input.changeMessage ?? null, createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_SKILL_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_SKILL_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SKILL_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SKILL_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('skillId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`, args: [skillId, versionNumber] },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SKILL_VERSION_BY_NUMBER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SKILL_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('skillId', 'column name')} = ?`, args: [skillId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`, limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_LATEST_SKILL_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    try {
      const { skillId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const whereClause = { sql: ` WHERE ${quoteIdentifier('skillId', 'column name')} = ?`, args: [skillId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_SKILL_VERSIONS, whereClause });
      if (total === 0) return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SKILL_VERSIONS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { versions: rows.map(row => this.parseVersionRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_SKILL_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try { await this.operations.delete({ tableName: TABLE_SKILL_VERSIONS, keys: { id } }); } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SKILL_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_SKILL_VERSIONS)} WHERE ${quoteIdentifier('skillId', 'column name')} = ?`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SKILL_VERSIONS_BY_SKILL', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async countVersions(skillId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_SKILL_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('skillId', 'column name')} = ?`, args: [skillId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'COUNT_SKILL_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }
}
