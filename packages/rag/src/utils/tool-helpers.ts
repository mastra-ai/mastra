import type { MastraUnion } from '@mastra/core/action';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraVector } from '@mastra/core/vector';

import type { VectorStoreResolver } from '../tools/types';

/**
 * Context for resolving vector stores.
 */
export interface ResolveVectorStoreContext {
  requestContext?: RequestContext;
  mastra?: MastraUnion;
  /** Fallback vector store name to look up from mastra if vectorStore option is not provided */
  vectorStoreName: string;
}

/**
 * Validates that a value is a valid MastraVector instance.
 * Performs a minimal runtime check - TypeScript types provide compile-time safety,
 * this just catches null/undefined from resolver functions at runtime.
 * @param value - The value to validate
 * @returns True if the value is a non-null object (presumed MastraVector)
 */
function isValidMastraVector(value: unknown): value is MastraVector {
  // Runtime check: ensure we have a non-null object
  // TypeScript types already enforce MastraVector shape at compile time
  return value !== null && value !== undefined && typeof value === 'object';
}

/**
 * Builds a context string for error messages from the ResolveVectorStoreContext.
 */
function buildContextString(context: ResolveVectorStoreContext): string {
  const parts: string[] = [];
  if (context.vectorStoreName) {
    parts.push(`vectorStoreName="${context.vectorStoreName}"`);
  }
  if (context.requestContext) {
    // Include request context info if available
    const schemaId = context.requestContext.get?.('schemaId');
    const tenantId = context.requestContext.get?.('tenantId');
    if (schemaId) parts.push(`schemaId="${schemaId}"`);
    if (tenantId) parts.push(`tenantId="${tenantId}"`);
  }
  if (context.mastra) {
    parts.push('mastra=provided');
  }
  return parts.length > 0 ? ` (context: ${parts.join(', ')})` : '';
}

/**
 * Resolves a vector store from options, supporting both static instances and dynamic resolver functions.
 * For multi-tenant setups, the resolver function receives the request context to select the appropriate store.
 *
 * @param options - Tool options object that may contain a vectorStore property
 * @param context - Context including requestContext, mastra instance, and fallback vectorStoreName
 * @returns The resolved MastraVector instance, or undefined if not found
 */
export async function resolveVectorStore(
  options: { vectorStore?: MastraVector | VectorStoreResolver } | Record<string, unknown>,
  context: ResolveVectorStoreContext,
): Promise<MastraVector | undefined> {
  const { requestContext, mastra, vectorStoreName } = context;

  if ('vectorStore' in options && options.vectorStore !== undefined) {
    const vectorStoreOption = options.vectorStore as MastraVector | VectorStoreResolver;
    // Support dynamic vector store resolution for multi-tenant setups
    if (typeof vectorStoreOption === 'function') {
      const resolved = await vectorStoreOption({ requestContext, mastra });

      // Validate that the resolver returned a valid MastraVector
      if (!isValidMastraVector(resolved)) {
        const contextStr = buildContextString(context);
        const receivedType = resolved === null ? 'null' : resolved === undefined ? 'undefined' : typeof resolved;

        console.error(
          `VectorStoreResolver returned invalid value: expected MastraVector instance, got ${receivedType}${contextStr}`,
        );

        // Fall back to mastra.getVector if available
        if (mastra && vectorStoreName) {
          return mastra.getVector(vectorStoreName);
        }

        return undefined;
      }

      return resolved;
    }

    // Validate static vectorStore option
    if (!isValidMastraVector(vectorStoreOption)) {
      const contextStr = buildContextString(context);
      const receivedType =
        vectorStoreOption === null ? 'null' : vectorStoreOption === undefined ? 'undefined' : typeof vectorStoreOption;

      console.error(`vectorStore option is not a valid MastraVector instance: got ${receivedType}${contextStr}`);

      // Fall back to mastra.getVector if available
      if (mastra && vectorStoreName) {
        return mastra.getVector(vectorStoreName);
      }

      return undefined;
    }

    return vectorStoreOption;
  }

  if (mastra) {
    return mastra.getVector(vectorStoreName);
  }

  return undefined;
}

/**
 * Coerces a topK value to a number, handling string inputs and providing a default.
 * @param topK - The value to coerce (number, string, or undefined)
 * @param defaultValue - Default value if coercion fails (defaults to 10)
 * @returns A valid number for topK
 */
export function coerceTopK(topK: number | string | undefined, defaultValue: number = 10): number {
  if (typeof topK === 'number' && !isNaN(topK)) {
    return topK;
  }
  if (typeof topK === 'string' && !isNaN(Number(topK))) {
    return Number(topK);
  }
  return defaultValue;
}

interface Logger {
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Parses a filter value, handling both string (JSON) and object inputs.
 * @param filter - The filter value to parse (string or object)
 * @param logger - Optional logger for error reporting
 * @returns Parsed filter object
 * @throws Error if filter is a string that cannot be parsed as JSON or if filter is not a plain object
 */
export function parseFilterValue(filter: unknown, logger?: Logger | null): Record<string, any> {
  if (!filter) {
    return {};
  }

  if (typeof filter === 'string') {
    try {
      return JSON.parse(filter);
    } catch (error) {
      if (logger) {
        logger.error('Invalid filter', { filter, error });
      }
      throw new Error(`Invalid filter format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Validate that non-string filter is a plain object
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) {
    if (logger) {
      logger.error('Invalid filter', { filter, error: 'Filter must be a plain object' });
    }
    throw new Error(
      `Invalid filter format: expected a plain object, got ${Array.isArray(filter) ? 'array' : typeof filter}`,
    );
  }

  return filter as Record<string, any>;
}
