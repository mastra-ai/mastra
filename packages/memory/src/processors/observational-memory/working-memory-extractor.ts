import { parseMemoryRequestContext } from '@mastra/core/memory';
import { z } from 'zod';

import { Extractor } from './extractor';
import type { ExtractorRuntimeContext } from './extractor';

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
      instructions: async context => buildWorkingMemoryInstructions(await getWorkingMemoryDetails(context)),
      schema: async context => {
        const details = await getWorkingMemoryDetails(context);
        return details.usesSchema ? z.union([z.record(z.string(), z.unknown()), z.null()]) : undefined;
      },
      onExtracted: async ({ current, memory, threadId, resourceId, requestContext }) => {
        const memoryConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
        const config = memory!.getMergedThreadConfig(memoryConfig ?? {});
        const isSchemaWorkingMemory = Boolean(config.workingMemory?.schema);

        if (isSchemaWorkingMemory && current === null) {
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
