import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import { isStandardSchemaWithJSON, toStandardSchema } from '@mastra/schema-compat/schema';
import { z } from 'zod';
import type { Memory } from '../..';

import { Extractor } from './extractor';
import type { ExtractorRuntimeContext } from './extractor';

type WorkingMemoryConfigSchema = NonNullable<
  NonNullable<ReturnType<Memory['getMergedThreadConfig']>['workingMemory']>['schema']
>;

function toZodSchema(schema: WorkingMemoryConfigSchema): z.ZodType<Record<string, unknown>> {
  if (schema instanceof z.ZodType) {
    return schema as z.ZodType<Record<string, unknown>>;
  }
  const standardSchema = isStandardSchemaWithJSON(schema) ? schema : toStandardSchema(schema);
  const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
  return z.fromJSONSchema(jsonSchema as Parameters<typeof z.fromJSONSchema>[0]) as z.ZodType<Record<string, unknown>>;
}

/** Resolves the configured working-memory schema as a nullable Zod schema, or undefined in Markdown mode. */
function getWorkingMemoryDocumentSchema(
  memory: Memory,
  requestContext: RequestContext | undefined,
): z.ZodType<Record<string, unknown> | null> | undefined {
  const memoryConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
  const schema = memory.getMergedThreadConfig(memoryConfig ?? {}).workingMemory?.schema;
  return schema ? toZodSchema(schema).nullable() : undefined;
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
        return details.usesSchema ? getWorkingMemoryDocumentSchema(context.memory!, context.requestContext) : undefined;
      },
      onExtracted: async ({ current, memory, threadId, resourceId, requestContext }) => {
        const memoryConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
        const documentSchema = getWorkingMemoryDocumentSchema(memory!, requestContext);

        if (documentSchema && (current === null || !documentSchema.safeParse(current).success)) {
          return undefined;
        }

        const workingMemory = typeof current === 'string' ? current : (JSON.stringify(current) ?? '');
        if (!workingMemory.trim()) {
          return undefined;
        }

        await memory!.updateWorkingMemory({
          threadId,
          resourceId,
          workingMemory,
          memoryConfig,
        });

        return current;
      },
    });
  }
}
