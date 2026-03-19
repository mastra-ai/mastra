import type { Client, InValue } from '@libsql/client';
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
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

/**
 * Config fields that live on version rows (from StorageSkillSnapshotType).
 */
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

export class SkillsLibSQL extends SkillsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SKILLS, schema: SKILLS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_SKILL_VERSIONS,
      schema: SKILL_VERSIONS_SCHEMA,
    });

    // Unique constraint on (skillId, versionNumber) to prevent duplicate versions from concurrent updates
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_versions_skill_version ON "${TABLE_SKILL_VERSIONS}" ("skillId", "versionNumber")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SKILLS });
    await this.#db.deleteData({ tableName: TABLE_SKILL_VERSIONS });
  }

  // ==========================================================================
  // Skill CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageSkillType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILLS)} FROM "${TABLE_SKILLS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseSkillRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    try {
      const now = new Date();

      // Insert thin skill record (no metadata on entity table)
      await this.#db.insert({
        tableName: TABLE_SKILLS,
        record: {
          id: skill.id,
          status: 'draft',
          activeVersionId: null,
          authorId: skill.authorId ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      // Extract config fields for version 1
      const { id: _id, authorId: _authorId, ...snapshotConfig } = skill;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          skillId: skill.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        });
      } catch (versionError) {
        // Clean up the orphaned skill record
        await this.#db.delete({ tableName: TABLE_SKILLS, keys: { id: skill.id } });
        throw versionError;
      }

      return {
        id: skill.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: skill.authorId,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SKILL', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Skill ${id} not found`,
          details: { skillId: id },
        });
      }

      const { authorId, activeVersionId, status, ...configFields } = updates;

      const configFieldNames = SNAPSHOT_FIELDS as readonly string[];
      const hasConfigUpdate = configFieldNames.some(field => field in configFields);

      // Build update data for the skill record (no metadata on entity table)
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) {
        updateData.activeVersionId = activeVersionId;
        if (status === undefined) {
          updateData.status = 'published';
        }
      }
      if (status !== undefined) updateData.status = status;

      await this.#db.update({
        tableName: TABLE_SKILLS,
        keys: { id },
        data: updateData,
      });

      // If config fields changed, create a new version
      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'UPDATE_SKILL', 'NO_VERSIONS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
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
        const changedFields = configFieldNames.filter(
          field =>
            field in configFields &&
            JSON.stringify(configFields[field as keyof typeof configFields]) !==
              JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          const newVersionId = crypto.randomUUID();
          await this.createVersion({
            id: newVersionId,
            skillId: id,
            versionNumber: latestVersion.versionNumber + 1,
            ...newConfig,
            changedFields,
            changeMessage: `Updated ${changedFields.join(', ')}`,
          });
        }
      }

      // Fetch and return updated skill
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SKILL', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Skill ${id} not found after update`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SKILLS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (authorId !== undefined) {
        conditions.push('authorId = ?');
        queryParams.push(authorId);
      }

      // Note: metadata filter is ignored for skills since the entity table doesn't have a metadata column.
      // Metadata lives on the version table.

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SKILLS}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          skills: [],
          total: 0,
          page,
          perPage: perPageInput ?? 100,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILLS)} FROM "${TABLE_SKILLS}" ${whereClause} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const skills = result.rows?.map(row => this.#parseSkillRow(row)) ?? [];

      return {
        skills,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SKILLS', 'FAILED'),
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
      const now = new Date();
      // Use raw SQL because "references" is a SQL reserved word and needs quoting
      await this.#client.execute({
        sql: `INSERT INTO "${TABLE_SKILL_VERSIONS}" (
          id, "skillId", "versionNumber",
          name, description, instructions, license, compatibility,
          source, "references", scripts, assets, metadata, tree,
          "changedFields", "changeMessage", "createdAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
          now.toISOString(),
        ],
      });

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILL_VERSIONS)} FROM "${TABLE_SKILL_VERSIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILL_VERSIONS)} FROM "${TABLE_SKILL_VERSIONS}" WHERE skillId = ? AND versionNumber = ?`,
        args: [skillId, versionNumber],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SKILL_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILL_VERSIONS)} FROM "${TABLE_SKILL_VERSIONS}" WHERE skillId = ? ORDER BY versionNumber DESC LIMIT 1`,
        args: [skillId],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    try {
      const { skillId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SKILL_VERSIONS}" WHERE skillId = ?`,
        args: [skillId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageInput ?? 20,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILL_VERSIONS)} FROM "${TABLE_SKILL_VERSIONS}" WHERE skillId = ? ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [skillId, limitValue, start],
      });

      const versions = result.rows?.map(row => this.#parseVersionRow(row)) ?? [];

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SKILL_VERSIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SKILL_VERSIONS}" WHERE "skillId" = ?`,
        args: [entityId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SKILL_VERSIONS_BY_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(skillId: string): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SKILL_VERSIONS}" WHERE skillId = ?`,
        args: [skillId],
      });
      return Number(result.rows?.[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  #parseSkillRow(row: Record<string, unknown>): StorageSkillType {
    return {
      id: row.id as string,
      status: (row.status as StorageSkillType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseVersionRow(row: Record<string, unknown>): SkillVersion {
    const safeParseJSON = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      id: row.id as string,
      skillId: row.skillId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      instructions: (row.instructions as string) ?? undefined,
      license: (row.license as string) ?? undefined,
      compatibility: safeParseJSON(row.compatibility) as SkillVersion['compatibility'],
      source: safeParseJSON(row.source) as SkillVersion['source'],
      references: safeParseJSON(row.references) as SkillVersion['references'],
      scripts: safeParseJSON(row.scripts) as SkillVersion['scripts'],
      assets: safeParseJSON(row.assets) as SkillVersion['assets'],
      metadata: safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      tree: safeParseJSON(row.tree) as SkillVersion['tree'],
      changedFields: safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
