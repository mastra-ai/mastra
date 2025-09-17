import type { Connection, FieldLike, SchemaLike } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_EVALS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

export function getPrimaryKeys(tableName: TABLE_NAMES): string[] {
  let primaryId: string[] = ['id'];
  if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
    primaryId = ['workflow_name', 'run_id'];
  } else if (tableName === TABLE_EVALS) {
    primaryId = ['agent_name', 'metric_name', 'run_id'];
  }

  return primaryId;
}

export function validateKeyTypes(keys: Record<string, any>, tableSchema: SchemaLike): void {
  // Create a map of field names to their expected types
  const fieldTypes = new Map(
    tableSchema.fields.map((field: any) => [field.name, field.type?.toString().toLowerCase()]),
  );

  for (const [key, value] of Object.entries(keys)) {
    const fieldType = fieldTypes.get(key);

    if (!fieldType) {
      throw new Error(`Field '${key}' does not exist in table schema`);
    }

    // Type validation
    if (value !== null) {
      if ((fieldType.includes('int') || fieldType.includes('bigint')) && typeof value !== 'number') {
        throw new Error(`Expected numeric value for field '${key}', got ${typeof value}`);
      }

      if (fieldType.includes('utf8') && typeof value !== 'string') {
        throw new Error(`Expected string value for field '${key}', got ${typeof value}`);
      }

      if (fieldType.includes('timestamp') && !(value instanceof Date) && typeof value !== 'string') {
        throw new Error(`Expected Date or string value for field '${key}', got ${typeof value}`);
      }
    }
  }
}

export function processResultWithTypeConversion(
  rawResult: Record<string, any> | Record<string, any>[],
  tableSchema: SchemaLike,
): Record<string, any> | Record<string, any>[] {
  // Build a map of field names to their schema types
  const fieldTypeMap = new Map();
  tableSchema.fields.forEach((field: any) => {
    const fieldName = field.name;
    const fieldTypeStr = field.type.toString().toLowerCase();
    fieldTypeMap.set(fieldName, fieldTypeStr);
  });

  // Handle array case
  if (Array.isArray(rawResult)) {
    return rawResult.map(item => processResultWithTypeConversion(item, tableSchema));
  }

  // Handle single record case
  const processedResult = { ...rawResult };

  // Convert each field according to its schema type
  for (const key in processedResult) {
    const fieldTypeStr = fieldTypeMap.get(key);
    if (!fieldTypeStr) continue;

    // Skip conversion for ID fields - preserve their original format
    // if (key === 'id') {
    //   continue;
    // }

    // Only try to convert string values
    if (typeof processedResult[key] === 'string') {
      // Numeric types
      if (fieldTypeStr.includes('int32') || fieldTypeStr.includes('float32')) {
        if (!isNaN(Number(processedResult[key]))) {
          processedResult[key] = Number(processedResult[key]);
        }
      } else if (fieldTypeStr.includes('int64')) {
        processedResult[key] = Number(processedResult[key]);
      } else if (fieldTypeStr.includes('utf8') && key !== 'id') {
        try {
          const parsed = JSON.parse(processedResult[key]);
          if (typeof parsed === 'object') {
            processedResult[key] = JSON.parse(processedResult[key]);
          }
        } catch {}
      }
    } else if (typeof processedResult[key] === 'bigint') {
      // Convert BigInt values to regular numbers for application layer
      processedResult[key] = Number(processedResult[key]);
    } else if (fieldTypeStr.includes('float64') && ['createdAt', 'updatedAt'].includes(key)) {
      processedResult[key] = new Date(processedResult[key]);
    }
  }

  return processedResult;
}

export async function getTableSchema({
  tableName,
  client,
}: {
  tableName: TABLE_NAMES;
  client: Connection;
}): Promise<SchemaLike> {
  try {
    if (!client) {
      throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
    }
    if (!tableName) {
      throw new Error('tableName is required for getTableSchema.');
    }
  } catch (validationError: any) {
    throw new MastraError(
      {
        id: 'STORAGE_LANCE_STORAGE_GET_TABLE_SCHEMA_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: validationError.message,
        details: { tableName },
      },
      validationError,
    );
  }

  try {
    const table = await client.openTable(tableName);
    const rawSchema = await table.schema();
    const fields = rawSchema.fields as FieldLike[];

    // Convert schema to SchemaLike format
    return {
      fields,
      metadata: new Map<string, string>(),
      get names() {
        return fields.map((field: FieldLike) => field.name);
      },
    };
  } catch (error: any) {
    throw new MastraError(
      {
        id: 'STORAGE_LANCE_STORAGE_GET_TABLE_SCHEMA_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { tableName },
      },
      error,
    );
  }
}
