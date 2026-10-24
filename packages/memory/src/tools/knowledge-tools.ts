import type { Knowledge } from '@mastra/core/knowledge';
import type { ToolAction } from '@mastra/core/tools';

import { createKnowledgeReadTools } from '../processors/observational-memory/subconscious/knowledge-tools';
import type {
  KnowledgeToolContext,
  KnowledgeToolsMemory,
} from '../processors/observational-memory/subconscious/knowledge-tools';
import {
  createKnowledgeWriteTools,
  resolveRunKnowledgeWriteOptions,
} from '../processors/observational-memory/subconscious/knowledge-write-tools';

export interface CreateKnowledgeToolsOptions {
  /** The Knowledge instance, or its key on the Mastra instance (resolved when a tool runs). */
  knowledge: string | Knowledge;
  /** Add the write tools. Writes default to the run's thread; nothing can hard-delete a node. */
  write?: boolean;
}

/**
 * Knowledge tools for one agent, scoped to each run's org, resource and thread. Read tools are
 * always included; search is lexical, since semantic search needs Memory's vector index.
 *
 * Use one Knowledge instance per agent: when the agent's Memory also hands out Knowledge tools
 * (`new Knowledge({ tools })`), Memory's tools replace these ones with the same id.
 */
export function createKnowledgeTools({
  knowledge,
  write = false,
}: CreateKnowledgeToolsOptions): Record<string, ToolAction<any, any, any>> {
  const host = (context: KnowledgeToolContext | undefined): KnowledgeToolsMemory => {
    let instance: Knowledge;
    if (typeof knowledge === 'string') {
      const mastra = context?.mastra;
      if (!mastra?.getKnowledge) {
        throw new Error(
          `Knowledge tools for "${knowledge}" need the agent registered with Mastra to resolve the Knowledge key.`,
        );
      }
      instance = mastra.getKnowledge(knowledge);
    } else {
      instance = knowledge;
    }
    return {
      getKnowledgeInstance: () => instance,
      getKnowledgeStore: () => instance.getStorage(),
      getKnowledgeSemanticIndex: async () => undefined,
    };
  };
  return {
    ...createKnowledgeReadTools(host),
    ...(write ? createKnowledgeWriteTools(host, resolveRunKnowledgeWriteOptions) : {}),
  };
}
