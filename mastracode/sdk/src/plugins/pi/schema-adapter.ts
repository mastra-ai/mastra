import { toStandardSchema } from '@mastra/schema-compat';
import type { JSONSchema7, StandardSchemaWithJSON } from '@mastra/schema-compat';

function isSchemaObject(value: unknown): value is JSONSchema7 {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function adaptPiTypeBoxSchema(schema: unknown, toolName: string): StandardSchemaWithJSON<unknown> {
  if (!isSchemaObject(schema)) {
    throw new Error(`Pi tool "${toolName}" parameters must be a TypeBox schema object`);
  }

  try {
    return toStandardSchema(schema);
  } catch (error) {
    throw new Error(
      `Pi tool "${toolName}" parameters could not be adapted: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function validatePiToolArguments(
  schema: StandardSchemaWithJSON<unknown>,
  input: unknown,
  toolName: string,
  source = 'arguments',
): Promise<unknown> {
  const result = await schema['~standard'].validate(input);
  if (!result.issues) return result.value;

  const details = result.issues
    .map(issue => {
      const path = issue.path?.map(segment => (typeof segment === 'object' ? segment.key : segment)).join('.');
      return `${path ? `${path}: ` : ''}${issue.message}`;
    })
    .join('; ');
  throw new Error(`Pi tool "${toolName}" received invalid ${source}: ${details}`);
}
