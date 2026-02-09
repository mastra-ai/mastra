import type { Logger, Mastra } from '@mastra/core';
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

import type { MastraEditor } from '../index';

export class EditorScorerNamespace {
  constructor(private editor: MastraEditor) {}

  private get mastra(): Mastra | undefined {
    return this.editor.__mastra;
  }

  private get logger(): Logger | undefined {
    return this.editor.__logger;
  }

  private async getStore() {
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('scorerDefinitions');
    if (!store) throw new Error('Scorer definitions storage domain is not available');
    return store;
  }

  async create(input: StorageCreateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.createScorerDefinition({ scorerDefinition: input });
    const resolved = await store.getScorerDefinitionByIdResolved({ id: input.id });
    if (!resolved) {
      throw new Error(`Failed to resolve scorer definition ${input.id} after creation`);
    }
    return resolved;
  }

  async getById(id: string): Promise<StorageResolvedScorerDefinitionType | null> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.getScorerDefinitionByIdResolved({ id });
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.updateScorerDefinition(input);
    const resolved = await store.getScorerDefinitionByIdResolved({ id: input.id });
    if (!resolved) {
      throw new Error(`Failed to resolve scorer definition ${input.id} after update`);
    }
    return resolved;
  }

  async delete(id: string): Promise<void> {
    this.ensureRegistered();
    const store = await this.getStore();
    await store.deleteScorerDefinition({ id });
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.listScorerDefinitions(args);
  }

  async listResolved(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsResolvedOutput> {
    this.ensureRegistered();
    const store = await this.getStore();
    return store.listScorerDefinitionsResolved(args);
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
      }).generateScore({
        description: `Score the output on a scale of ${min} to ${max}`,
        createPrompt: ({ run }) => {
          const input = typeof run.input === 'string' ? run.input : JSON.stringify(run.input);
          const output = typeof run.output === 'string' ? run.output : JSON.stringify(run.output);
          return `Evaluate the following interaction and provide a score between ${min} and ${max}.

Input: ${input}

Output: ${output}

Provide your score as a JSON object with a "score" field containing a number between ${min} and ${max}.`;
        },
      }).generateReason({
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

  private ensureRegistered(): void {
    if (!this.editor.__mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }
  }
}
