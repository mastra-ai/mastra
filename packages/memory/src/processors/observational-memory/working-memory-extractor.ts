import { parseMemoryRequestContext } from '@mastra/core/memory';
import { toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema } from '@mastra/core/schema';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { z } from 'zod';

import { deepMergeWorkingMemory, parseWorkingMemoryJson, stripNullsFromOptional } from '../../tools/working-memory';
import { Extractor } from './extractor';
import type { ExtractorRuntimeContext } from './extractor';

/**
 * The structured-output schema for this extractor stays generic because every structured extractor shares one
 * response object: a strict working-memory schema there would make one invalid document fail every sibling
 * extractor. The configured schema is enforced here instead, with its own validator, before anything is stored.
 * Like the working memory tool, nulls in optional fields are treated as "not provided" rather than as invalid.
 */
async function validateAgainstConfiguredSchema(schema: PublicSchema, value: unknown): Promise<unknown> {
  const standardSchema = toStandardSchema(schema);
  const jsonSchema = standardSchemaToJSONSchema(standardSchema, { io: 'input' }) as Record<string, unknown>;
  const result = await standardSchema['~standard'].validate(stripNullsFromOptional(value, jsonSchema));
  if (!result.issues) {
    return result.value;
  }

  const details = result.issues
    .map(issue => {
      const path = issue.path?.map(segment => String(typeof segment === 'object' ? segment.key : segment)).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
  throw new Error(`Working memory update does not match the configured schema, so it was not saved: ${details}`);
}

const patchLocks = new Map<string, Promise<void>>();

/** Runs `fn` after every earlier call for the same key has settled. */
async function withPatchLock(key: string, fn: () => Promise<void>): Promise<void> {
  const previous = patchLocks.get(key) ?? Promise.resolve();
  const run = previous.then(fn);
  const tail = run.catch(() => undefined);
  patchLocks.set(key, tail);
  try {
    await run;
  } finally {
    if (patchLocks.get(key) === tail) {
      patchLocks.delete(key);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyPlainObject(value: unknown): boolean {
  return isPlainObject(value) && Object.keys(value).length === 0;
}

/**
 * Resource-scoped working memory is shared by every thread of the resource, and thread-scoped Observers of
 * sibling threads can run at the same time. Asking for the full document there means the last writer silently
 * drops what the others saved, so schema-based resource-scoped working memory is updated with a patch instead.
 */
function usesPatchSemantics(workingMemory: { schema?: unknown; scope?: 'thread' | 'resource' } | undefined): boolean {
  return Boolean(workingMemory?.schema) && (workingMemory?.scope ?? 'resource') === 'resource';
}

async function getWorkingMemoryDetails(context: ExtractorRuntimeContext): Promise<{
  template?: string;
  current?: string | null;
  usesSchema: boolean;
  usesPatch: boolean;
}> {
  const memory = context.memory!;
  const memoryConfig = parseMemoryRequestContext(context.requestContext)?.memoryConfig;
  const config = memory.getMergedThreadConfig(memoryConfig ?? {});
  const workingMemory = config.workingMemory;
  if (!workingMemory?.enabled) {
    return { usesSchema: false, usesPatch: false };
  }

  const [template, current] = await Promise.all([
    memory.getWorkingMemoryTemplate({ memoryConfig }),
    context.threadId
      ? memory.getWorkingMemory({
          threadId: context.threadId,
          resourceId: context.resourceId,
          memoryConfig,
        })
      : Promise.resolve(null),
  ]);

  return {
    template: typeof template?.content === 'string' ? template.content : JSON.stringify(template?.content),
    current,
    usesSchema: Boolean(workingMemory.schema),
    usesPatch: usesPatchSemantics(workingMemory),
  };
}

function buildWorkingMemoryInstructions(details: Awaited<ReturnType<typeof getWorkingMemoryDetails>>): string {
  if (details.usesPatch) {
    return [
      'Update working memory with durable facts from the observations you made.',
      'Return a JSON object with ONLY the fields to add or change. Omit fields that stay the same: omitted fields are kept as they are. Set a field to null to delete it. Arrays replace the stored array, so return the complete array.',
      'Return null when no working memory update is needed.',
      details.template ? `Working memory JSON schema:\n${details.template}` : undefined,
      details.current ? `Current working memory JSON:\n${details.current}` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (details.usesSchema) {
    return [
      'Update working memory with durable facts from the observations you made.',
      'Return the full updated JSON object when working memory should change.',
      'Return null when no working memory update is needed.',
      details.template ? `Working memory JSON schema:\n${details.template}` : undefined,
      details.current ? `Current working memory JSON:\n${details.current}` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    'Update working memory with durable facts from the observations you made.',
    'Return the full updated Markdown working memory. Preserve useful existing content and add or revise only what changed.',
    details.template ? `Working memory template:\n${details.template}` : undefined,
    details.current ? `Current working memory:\n${details.current}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export class WorkingMemoryExtractor extends Extractor<string | Record<string, unknown> | null> {
  constructor() {
    super({
      name: 'Working Memory',
      includePreviousExtraction: false,
      metadataKeyPath: false,
      retryStructuredExtractionOnEmptyObject: true,
      instructions: async context => buildWorkingMemoryInstructions(await getWorkingMemoryDetails(context)),
      schema: async context => {
        const details = await getWorkingMemoryDetails(context);
        return details.usesSchema ? z.union([z.record(z.string(), z.unknown()), z.null()]) : undefined;
      },
      onExtracted: async ({ current, memory, threadId, resourceId, requestContext }) => {
        const memoryConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
        const config = memory!.getMergedThreadConfig(memoryConfig ?? {});
        const configuredSchema = config.workingMemory?.schema;

        if (configuredSchema && usesPatchSemantics(config.workingMemory)) {
          if (current === null || isEmptyPlainObject(current)) {
            return undefined;
          }
          if (!isPlainObject(current)) {
            throw new Error(
              'Working memory update does not match the configured schema, so it was not saved: expected a JSON object',
            );
          }

          // Validate the document the patch produces, so required fields, types and null deletions are checked
          // as a whole. The patch itself is what gets merged, so fields a sibling thread saved meanwhile survive.
          const validateMergedDocument = async () => {
            const existing = await memory!.getWorkingMemory({ threadId, resourceId, memoryConfig });
            const merged = deepMergeWorkingMemory(parseWorkingMemoryJson(existing), current);
            await validateAgainstConfiguredSchema(configuredSchema, merged);
            return merged;
          };

          if (await memory!.supportsAtomicWorkingMemoryMerge()) {
            await validateMergedDocument();
            await memory!.mergeWorkingMemory({ threadId, resourceId, workingMemory: current, memoryConfig });
          } else {
            // Without an atomic storage merge, serialize the read-merge-write so sibling threads in this process
            // cannot overwrite each other. Other processes are only protected by stores with an atomic merge.
            await withPatchLock(resourceId ?? threadId, async () => {
              const merged = await validateMergedDocument();
              await memory!.updateWorkingMemory({
                threadId,
                resourceId,
                workingMemory: JSON.stringify(merged),
                memoryConfig,
              });
            });
          }

          return current;
        }

        let document: unknown = current;
        if (configuredSchema) {
          // An empty object carries no update (some providers, e.g. Gemini, can only emit `{}` for the generic
          // record schema), and storing it would wipe the existing working memory.
          if (current === null || isEmptyPlainObject(current)) {
            return undefined;
          }
          document = await validateAgainstConfiguredSchema(configuredSchema, current);
          // Validation drops nulls in optional fields, so `{"name": null}` can become `{}`.
          if (document === null || isEmptyPlainObject(document)) {
            return undefined;
          }
        }

        const workingMemory = typeof document === 'string' ? document : (JSON.stringify(document) ?? '');
        if (!workingMemory.trim()) {
          return undefined;
        }

        await memory!.updateWorkingMemory({
          threadId,
          resourceId,
          workingMemory,
          memoryConfig,
        });

        return document as Record<string, unknown> | string;
      },
    });
  }
}
