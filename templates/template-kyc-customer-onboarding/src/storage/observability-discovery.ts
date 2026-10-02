import type { Client } from '@libsql/client';
import {
  EntityType,
  TABLE_SPANS,
  type GetEntityNamesArgs,
  type GetEntityNamesResponse,
  type GetEntityTypesResponse,
  type GetEnvironmentsResponse,
  type GetServiceNamesResponse,
  type GetTagsArgs,
  type GetTagsResponse,
} from '@mastra/core/storage';
import { ObservabilityLibSQL } from '@mastra/libsql';

import { createMastraSqliteClient } from './mastra-sqlite-client.js';

type DiscoveryColumn = 'entityName' | 'entityType' | 'environment' | 'serviceName';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export class KycObservabilityLibSQL extends ObservabilityLibSQL {
  constructor(private readonly discoveryClient: Client) {
    super({ client: createMastraSqliteClient(discoveryClient) });
  }

  private async distinctValues(
    column: DiscoveryColumn,
    entityType?: (typeof EntityType)[keyof typeof EntityType],
  ): Promise<string[]> {
    const filter = entityType === undefined ? '' : ' AND "entityType" = ?';
    const result = await this.discoveryClient.execute({
      sql: `SELECT DISTINCT "${column}" AS value FROM "${TABLE_SPANS}" WHERE "${column}" IS NOT NULL AND "${column}" <> ''${filter} ORDER BY value`,
      args: entityType === undefined ? [] : [entityType],
    });

    return result.rows.map(row => row.value).filter(isNonEmptyString);
  }

  override async getEntityTypes(): Promise<GetEntityTypesResponse> {
    const validEntityTypes = new Set(Object.values(EntityType));
    const entityTypes = (await this.distinctValues('entityType')).filter(value =>
      validEntityTypes.has(value as (typeof EntityType)[keyof typeof EntityType]),
    ) as GetEntityTypesResponse['entityTypes'];

    return { entityTypes };
  }

  override async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    return { names: await this.distinctValues('entityName', args.entityType) };
  }

  override async getServiceNames(): Promise<GetServiceNamesResponse> {
    return { serviceNames: await this.distinctValues('serviceName') };
  }

  override async getEnvironments(): Promise<GetEnvironmentsResponse> {
    return { environments: await this.distinctValues('environment') };
  }

  override async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    const filter = args.entityType === undefined ? '' : 'WHERE spans."entityType" = ?';
    const result = await this.discoveryClient.execute({
      sql: `SELECT DISTINCT tag.value AS value FROM "${TABLE_SPANS}" AS spans, json_each(spans."tags") AS tag ${filter} ORDER BY value`,
      args: args.entityType === undefined ? [] : [args.entityType],
    });

    return { tags: result.rows.map(row => row.value).filter(isNonEmptyString) };
  }

  close(): void {
    if (!this.discoveryClient.closed) this.discoveryClient.close();
  }
}
