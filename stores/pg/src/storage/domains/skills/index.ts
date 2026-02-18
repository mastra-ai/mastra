import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  SkillsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  SkillVersion,
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
} from '@mastra/core/storage/domains/skills';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'instructions',
  'license',
  'compatibility',
  'source',
  'references',
  'scripts',
  'assets',
  'metadata',
  'tree',
] as const;

export class SkillsPG extends SkillsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SKILLS, TABLE_SKILL_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (SkillsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_skill_versions_skill_version',
        table: TABLE_SKILL_VERSIONS,
        columns: ['skillId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch {
        // Indexes are performance optimizations, continue on failure
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_SKILLS,
      schema: TABLE_SCHEMAS[TABLE_SKILLS],
    });
    await this.#db.createTable({
      tableName: TABLE_SKILL_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_SKILL_VERSIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SKILL_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_SKILLS });
  }

  // ==========================================================================
  // Skill CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageSkillType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseSkillRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SKILL_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin skill record (no metadata on entity)
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, status, "activeVersionId", "authorId",
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [skill.id, 'draft', null, skill.authorId ?? null, nowIso, nowIso, nowIso, nowIso],
      );

      // 2. Extract snapshot fields and create version 1
      const { id: _id, authorId: _authorId, ...snapshotConfig } = skill;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        skillId: skill.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: [...SNAPSHOT_FIELDS],
        changeMessage: 'Initial version',
      });

      return {
        id: skill.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: skill.authorId,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      // Best-effort cleanup
      try {
        const tableName = getTableName({
          indexName: TABLE_SKILLS,
          schemaName: getSchemaName(this.#schema),
        });
        await this.#db.client.none(
          `DELETE FROM ${tableName} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [skill.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: skill.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });

      const existingSkill = await this.getById(id);
      if (!existingSkill) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SKILL', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Skill ${id} not found`,
          details: { skillId: id },
        });
      }

      const { authorId, activeVersionId, status, ...configFields } = updates;
      let versionCreated = false;

      // Check if any snapshot config fields are present
      const hasConfigUpdate = SNAPSHOT_FIELDS.some(field => field in configFields);

      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UPDATE_SKILL', 'NO_VERSIONS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: `No versions found for skill ${id}`,
            details: { skillId: id },
          });
        }

        const {
          id: _versionId,
          skillId: _skillId,
          versionNumber: _versionNumber,
          changedFields: _changedFields,
          changeMessage: _changeMessage,
          createdAt: _createdAt,
          ...latestConfig
        } = latestVersion;

        const newConfig = { ...latestConfig, ...configFields };
        const changedFields = SNAPSHOT_FIELDS.filter(
          field =>
            field in configFields &&
            JSON.stringify(configFields[field as keyof typeof configFields]) !==
              JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          versionCreated = true;
          const newVersionId = crypto.randomUUID();
          await this.createVersion({
            id: newVersionId,
            skillId: id,
            versionNumber: latestVersion.versionNumber + 1,
            ...newConfig,
            changedFields: [...changedFields],
            changeMessage: `Updated ${changedFields.join(', ')}`,
          });
        }
      }

      // Update metadata fields on the skill record (no metadata column on entity)
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (authorId !== undefined) {
        setClauses.push(`"authorId" = $${paramIndex++}`);
        values.push(authorId);
      }

      if (activeVersionId !== undefined) {
        setClauses.push(`"activeVersionId" = $${paramIndex++}`);
        values.push(activeVersionId);
        // Auto-set status to 'published' when activeVersionId is set, consistent with InMemory and LibSQL
        if (status === undefined) {
          setClauses.push(`status = $${paramIndex++}`);
          values.push('published');
        }
      }

      if (status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      // Always update timestamps
      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      values.push(id);

      if (setClauses.length > 2 || versionCreated) {
        // More than just updatedAt and updatedAtZ, or a new version was created
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      const updatedSkill = await this.getById(id);
      if (!updatedSkill) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SKILL', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Skill ${id} not found after update`,
          details: { skillId: id },
        });
      }
      return updatedSkill;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });
      await this.deleteVersionsByParentId(id);
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SKILLS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const tableName = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions (no metadata column on entity)
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      if (authorId !== undefined) {
        conditions.push(`"authorId" = $${paramIdx++}`);
        queryParams.push(authorId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          skills: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "${field}" ${direction} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...queryParams, limitValue, offset],
      );

      const skills = (dataResult || []).map(row => this.parseSkillRow(row));

      return {
        skills,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SKILLS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Skill Version Methods
  // ==========================================================================

  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "skillId", "versionNumber",
          name, description, instructions, license, compatibility,
          source, "references", scripts, assets, metadata, tree,
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          input.id,
          input.skillId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          input.instructions ?? null,
          input.license ?? null,
          input.compatibility ? JSON.stringify(input.compatibility) : null,
          input.source ? JSON.stringify(input.source) : null,
          input.references ? JSON.stringify(input.references) : null,
          input.scripts ? JSON.stringify(input.scripts) : null,
          input.assets ? JSON.stringify(input.assets) : null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.tree ? JSON.stringify(input.tree) : null,
          input.changedFields ? JSON.stringify(input.changedFields) : null,
          input.changeMessage ?? null,
          nowIso,
          nowIso,
        ],
      );

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, skillId: input.skillId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "skillId" = $1 AND "versionNumber" = $2`,
        [skillId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SKILL_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "skillId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [skillId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    const { skillId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SKILL_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "skillId" = $1`, [
        skillId,
      ]);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "skillId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [skillId, limitValue, offset],
      );

      const versions = (dataResult || []).map(row => this.parseVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "skillId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SKILL_VERSIONS_BY_SKILL_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(skillId: string): Promise<number> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SKILL_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "skillId" = $1`, [
        skillId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseSkillRow(row: any): StorageSkillType {
    return {
      id: row.id as string,
      status: row.status as StorageSkillType['status'],
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseVersionRow(row: any): SkillVersion {
    return {
      id: row.id as string,
      skillId: row.skillId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      description: row.description as string,
      instructions: row.instructions as string,
      license: row.license as string | undefined,
      compatibility: this.parseJson(row.compatibility, 'compatibility'),
      source: this.parseJson(row.source, 'source'),
      references: this.parseJson(row.references, 'references'),
      scripts: this.parseJson(row.scripts, 'scripts'),
      assets: this.parseJson(row.assets, 'assets'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      tree: this.parseJson(row.tree, 'tree'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }
}
