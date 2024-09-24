import { prisma } from '../prisma/client';
import {
  Property,
  Record as RecordDataType,
  PrismaClient,
} from '@prisma-app/client';
import { PropertyService } from './service.property';
import { getFilterClauseSQL } from '../lib/query-builder/filters/sql';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { FilterObject } from '../lib/query-builder/types';
import { getSortClauseSQL } from '../lib/query-builder/sorts/sql';

export class RecordService<T extends typeof prisma> {
  db: PrismaClient;
  propertyService: PropertyService<T>;

  constructor({ db }: { db: T }) {
    this.db = db as unknown as PrismaClient;
    this.propertyService = new PropertyService({ db });
  }

  buildRecordQuerySql({
    whereClause,
    filterClause,
    sortClauses,
    entityType,
  }: {
    whereClause: string;
    filterClause?: string;
    entityType: string;
    sortClauses: string[];
  }) {
    return `
      SELECT
    "kepler"."records".*,
    row_to_json("kepler"."entity".*) AS "entity"
    FROM "kepler"."records"
    LEFT JOIN "kepler"."entity" ON "kepler"."entity"."id" = "kepler"."records"."entityId"
    ${whereClause}
    ${entityType ? `AND "kepler"."entity"."type" = '${entityType}'` : ''}
    AND "records"."deletedAt" IS NULL
    ${filterClause ? `AND ${filterClause}` : ''}
    ORDER BY ${sortClauses.length > 0 ? sortClauses.join(', ') : ''}
    `;
  }

  async getFilteredRecords<T extends string | number | symbol>({
    entityType,
    k_id,
    filters,
    sort,
  }: {
    entityType: string;
    filters?: FilterObject<T>;
    sort?: string[];
    k_id: string;
  }) {
    const properties = await this.propertyService.getPropertiesByEntityType({
      entityType,
    });

    const dateFields = [
      {
        name: `createdAt`,
        type: `DATE`,
      },
      {
        name: `updatedAt`,
        type: `DATE`,
      },
    ];

    const fullProperties = [...properties, ...dateFields] as Property[];

    let filterClause = '',
      sortClauses: string[] = [`"kepler"."records"."createdAt" DESC`];

    if (filters) {
      filterClause = getFilterClauseSQL({
        filters,
        fields: fullProperties,
        parentTableRef: 'records',
      });
    }

    if (sort) {
      sortClauses = getSortClauseSQL({
        sort,
        fields: fullProperties,
        parentTableRef: 'records',
      });
    }

    const sqlStatement = this.buildRecordQuerySql({
      whereClause: `WHERE "kepler"."entity"."k_id" = '${k_id}'`,
      filterClause,
      sortClauses,
      entityType,
    });

    try {
      const records = await this.db.$queryRawUnsafe<RecordDataType[]>(
        sqlStatement
      );

      return records;
    } catch (e) {
      if (e instanceof PrismaClientValidationError) {
        return [] as any;
      }

      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2010' && e.meta && e.meta.code === '42703') {
          // return empty array if code is P2010 and meta.code is 42703, as it means an applied filter is invalid
          // e.g. searching for a non-existent field
          return [] as any;
        }
      }
      throw e;
    }
  }
}

export const recordService = new RecordService({ db: prisma });
