import { parseMemoryRequestContext } from '@mastra/core/memory';
import { toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema } from '@mastra/core/schema';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { z } from 'zod';

import { stripNullsFromOptional } from '../../tools/working-memory';
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

async function getWorkingMemoryDetails(context: ExtractorRuntimeContext): Promise<{
  template?: string;
  current?: string | null;
  usesSchema: boolean;
}> {
  const memory = context.memory!;
  const memoryConfig = parseMemoryRequestContext(context.requestContext)?.memoryConfig;
  const config = memory.getMergedThreadConfig(memoryConfig ?? {});
  const workingMemory = config.workingMemory;
  if (!workingMemory?.enabled) {
    return { usesSchema: false };
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
  };
}

function buildWorkingMemoryInstructions(details: Awaited<ReturnType<typeof getWorkingMemoryDetails>>): string {
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

        let document: unknown = current;
        if (configuredSchema) {
          if (current === null) {
            return undefined;
          }
          document = await validateAgainstConfiguredSchema(configuredSchema, current);
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
