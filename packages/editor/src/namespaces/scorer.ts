import { createScorer } from '@mastra/core/evals';
import type { MastraScorer } from '@mastra/core/evals';
import type {
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageResolvedScorerDefinitionType,
  StorageListScorerDefinitionsResolvedOutput,
} from '@mastra/core/storage';

import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorScorerNamespace extends CrudEditorNamespace<
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageListScorerDefinitionsResolvedOutput,
  StorageResolvedScorerDefinitionType
> {
  protected override onCacheEvict(id: string): void {
    this.mastra?.removeScorer(id);
  }

  /**
   * Hydrate a stored scorer definition into a runtime MastraScorer instance
   * and register it on the Mastra instance so it can be discovered via
   * `mastra.getScorer()` / `mastra.getScorerById()`.
   */
  protected override async hydrate(
    storedScorer: StorageResolvedScorerDefinitionType,
  ): Promise<StorageResolvedScorerDefinitionType> {
    const scorer = this.resolve(storedScorer);
    if (scorer && this.mastra) {
      this.mastra.addScorer(scorer, storedScorer.id, { source: 'stored' });
    }
    return storedScorer;
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateScorerDefinitionInput,
      StorageUpdateScorerDefinitionInput,
      StorageListScorerDefinitionsInput,
      StorageListScorerDefinitionsOutput,
      StorageListScorerDefinitionsResolvedOutput,
      StorageResolvedScorerDefinitionType
    >
  > {
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('scorerDefinitions');
    if (!store) throw new Error('Scorer definitions storage domain is not available');

    return {
      create: input => store.create({ scorerDefinition: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  /**
   * Create a MastraScorer instance from a stored scorer definition.
   * Supports:
   * - 'llm-judge': Creates a scorer with a single LLM call using custom instructions
   * - Preset types (e.g., 'bias', 'toxicity'): Not yet supported, returns null
   */
  resolve(storedScorer: StorageResolvedScorerDefinitionType): MastraScorer<any, any, any, any> | null {
    if (storedScorer.type === 'llm-judge') {
      if (!storedScorer.instructions) {
        this.logger?.warn(`Stored scorer "${storedScorer.id}" is llm-judge but has no instructions`);
        return null;
      }

      const modelConfig = storedScorer.model;
      if (!modelConfig?.provider || !modelConfig?.name) {
        this.logger?.warn(`Stored scorer "${storedScorer.id}" has no valid model configuration`);
        return null;
      }

      const model = `${modelConfig.provider}/${modelConfig.name}`;
      const min = storedScorer.scoreRange?.min ?? 0;
      const max = storedScorer.scoreRange?.max ?? 1;

      const scorer = createScorer({
        id: storedScorer.id,
        name: storedScorer.name,
        description: storedScorer.description || `Custom LLM judge scorer: ${storedScorer.name}`,
        type: 'agent',
        judge: {
          model,
          instructions: storedScorer.instructions,
        },
      })
        .generateScore({
          description: `Score the output on a scale of ${min} to ${max}`,
          createPrompt: ({ run }) => {
            const input = typeof run.input === 'string' ? run.input : JSON.stringify(run.input);
            const output = typeof run.output === 'string' ? run.output : JSON.stringify(run.output);
            return `Evaluate the following interaction and provide a score between ${min} and ${max}.

Input: ${input}

Output: ${output}

Provide your score as a JSON object with a "score" field containing a number between ${min} and ${max}.`;
          },
        })
        .generateReason({
          description: 'Explain the reasoning behind the score',
          createPrompt: ({ run, score }) => {
            const input = typeof run.input === 'string' ? run.input : JSON.stringify(run.input);
            const output = typeof run.output === 'string' ? run.output : JSON.stringify(run.output);
            return `You scored the following interaction ${score} out of ${max}.

Input: ${input}

Output: ${output}

Explain your reasoning for this score in a clear, concise paragraph.`;
          },
        });

      if (this.mastra) {
        scorer.__registerMastra(this.mastra);
      }

      return scorer;
    }

    // Preset types — not yet supported
    this.logger?.warn(
      `Stored scorer "${storedScorer.id}" has type "${storedScorer.type}" which is a preset type. ` +
        `Preset instantiation from stored config is not yet supported.`,
    );
    return null;
  }
}
