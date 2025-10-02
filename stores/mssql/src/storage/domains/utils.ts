import { parseSqlIdentifier } from '@mastra/core/utils';

export function getSchemaName(schema?: string) {
  return schema ? `[${parseSqlIdentifier(schema, 'schema name')}]` : undefined;
}

export function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
  const quotedIndexName = `[${parsedIndexName}]`;
  const quotedSchemaName = schemaName;
  return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
}
