import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel, MastraLegacyLanguageModel } from '@mastra/core/agent';
import type { z } from 'zod';

import type { BaseNode } from '../schema';

import { BaseExtractor } from './base';
import { baseLLM } from './types';
import type { SchemaExtractArgs } from './types';

export class SchemaExtractor<T extends z.ZodType> extends BaseExtractor {
  private schema: T;
  private llm?: MastraLanguageModel | MastraLegacyLanguageModel;
  private instructions?: string;
  private metadataKey?: string;

  constructor(options: SchemaExtractArgs<T>) {
    super();
    this.schema = options.schema;
    this.llm = options.llm;
    this.instructions = options.instructions;
    this.metadataKey = options.metadataKey;
  }

  async extract(nodes: BaseNode[]): Promise<Record<string, any>[]> {
    const agent = new Agent({
      name: 'schema-extractor',
      id: 'schema-extractor',
      instructions: this.instructions ?? 'Extract structured data from the provided text.',
      model: this.llm ?? baseLLM,
    });
    const results = await Promise.all(
      nodes.map(async node => {
        try {
          const result = await agent.generate([{ role: 'user', content: node.getContent() }], {
            structuredOutput: { schema: this.schema as any },
          });

          // Nest under key or spread flat
          if (this.metadataKey) {
            return { [this.metadataKey]: result.object };
          }
          return result.object;
        } catch (error) {
          // Log warning and return empty object (consistent with existing extractors)
          console.error('Schema extraction failed:', error);
          return {};
        }
      }),
    );

    return results;
  }
}
