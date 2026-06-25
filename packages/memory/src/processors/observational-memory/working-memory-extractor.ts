import { parseMemoryRequestContext } from '@mastra/core/memory';

import type { Memory } from '../..';
import { deepMergeWorkingMemory } from '../../tools/working-memory';
import { Extractor } from './extractor';
import type { ExtractorRuntimeContext } from './extractor';

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function getWorkingMemoryDetails(context: ExtractorRuntimeContext): Promise<{
  memory?: Memory;
  template?: string;
  current?: string | null;
  usesSchema: boolean;
}> {
  const memory = context.memory;
  if (!memory) {
    return { usesSchema: false };
  }

  const memoryConfig = parseMemoryRequestContext(context.requestContext)?.memoryConfig;
  const config = memory.getMergedThreadConfig(memoryConfig ?? {});
  const workingMemory = config.workingMemory;
  if (!workingMemory?.enabled) {
    return { memory, usesSchema: false };
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
    memory,
    template: typeof template?.content === 'string' ? template.content : JSON.stringify(template?.content),
    current,
    usesSchema: Boolean(workingMemory.schema),
  };
}

function buildWorkingMemoryInstructions(details: Awaited<ReturnType<typeof getWorkingMemoryDetails>>): string {
  if (!details.memory) {
    return 'Working memory is unavailable. Do not output this section.';
  }

  if (details.usesSchema) {
    return [
      'Update working memory with durable facts from the observations you made.',
      'Return only a JSON object containing fields to add or update. Omit unchanged fields.',
      'Arrays replace existing arrays when provided, so include the complete array only when it changed.',
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

export class WorkingMemoryExtractor extends Extractor<string> {
  constructor() {
    super({
      name: 'Working Memory',
      includePreviousExtraction: false,
      instructions: async context => buildWorkingMemoryInstructions(await getWorkingMemoryDetails(context)),
      onExtracted: async ({ current, memory, threadId, resourceId, requestContext }) => {
        if (!memory) {
          throw new Error('Working memory extractor requires an active Memory instance.');
        }

        const memoryConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
        const config = memory.getMergedThreadConfig(memoryConfig ?? {});
        if (!config.workingMemory?.enabled) {
          throw new Error('Working memory is not enabled for this memory instance.');
        }

        let workingMemory = current;
        if (config.workingMemory.schema) {
          const existing = parseJsonObject(await memory.getWorkingMemory({ threadId, resourceId, memoryConfig }));
          const update = parseJsonObject(current);
          if (!update) {
            throw new Error('Working memory extractor expected a JSON object update.');
          }
          workingMemory = JSON.stringify(deepMergeWorkingMemory(existing, update));
        }

        await memory.updateWorkingMemory({
          threadId,
          resourceId,
          workingMemory,
          memoryConfig,
        });

        return undefined;
      },
    });
  }
}
